import React, { useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
// Replacing Radix Tabs with simple toggle to avoid runtime error
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Tesseract from "tesseract.js";

function normalizeBatchCode(raw?: string): string | undefined {
  if (!raw) return undefined;
  let s = raw.trim().toUpperCase();
  s = s.replace(/[^A-Z0-9\-\/]/g, "");
  s = s
    .replace(/(?<=\d)O(?=\d)/g, "0")
    .replace(/(?<=\d)I(?=\d)/g, "1")
    .replace(/(?<=\d)S(?=\d)/g, "5")
    .replace(/(?<=\d)B(?=\d)/g, "8")
    .replace(/(?<=\d)Z(?=\d)/g, "2");
  return s;
}
function toDateInput(s?: string | null): string | undefined {
  if (!s) return undefined;
  try {
    const d = new Date(s);
    if (Number.isNaN(+d)) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return undefined;
  }
}
function extractFromOcrText(text: string): { batch?: string; expiry?: string } {
  const t = text.replace(/\s+/g, " ").trim();
  // Look for explicit labels or generic code-like tokens
  const batchMatch =
    t.match(/(?:BATCH(?:\s*CODE)?|LOT(?:\s*NO)?)[^\w]{0,3}([A-Z0-9][A-Z0-9\-\/]{2,})\b/i) ||
    t.match(/\b(PROD-[A-Z0-9\-]{3,})\b/i) ||
    t.match(/\b([A-Z0-9][A-Z0-9\-\/]{5,})\b/);
  const dateLabeled = t.match(/(?:EXP|Expiry|Best\s*Before|Use\s*By|BBE)[\s:]*([^\s,;]{3,})/i)?.[1];
  const dateRaw =
    dateLabeled ||
    t.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/)?.[1] ||
    t.match(/(\d{4}-\d{1,2}-\d{1,2})/)?.[1] ||
    t.match(/(\d{1,2}\s*[A-Za-z]{3,5}\s*\d{2,4})/)?.[1];
  return { batch: normalizeBatchCode(batchMatch?.[1]), expiry: toDateInput(dateRaw) };
}

// Simple preprocessing: grayscale + binarize with mean threshold
function preprocessCanvasForOCR(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, invert = false): string {
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = data[i + 1] = data[i + 2] = lum;
    sum += lum;
  }
  const mean = sum / (data.length / 4);
  const thresh = Math.min(255, Math.max(0, mean * 0.95));
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] < thresh) !== invert ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

async function createOcrVariants(srcDataUrl: string): Promise<string[]> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.crossOrigin = 'anonymous';
    img.src = srcDataUrl;
  });
  const makeVariant = (rotation: number, invert: boolean): string => {
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const w0 = img.width, h0 = img.height;
    const w = Math.round(w0 * cos + h0 * sin);
    const h = Math.round(w0 * sin + h0 * cos);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d')!;
    cx.translate(w / 2, h / 2);
    cx.rotate(rad);
    cx.drawImage(img, -w0 / 2, -h0 / 2);
    return preprocessCanvasForOCR(c, cx, invert);
  };
  return [
    makeVariant(0, false),
    makeVariant(0, true),
    makeVariant(90, false),
    makeVariant(270, false),
  ];
}

export function LabelsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrText, setOcrText] = useState("");
  const [confidence, setConfidence] = useState<number>(0);
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [productId, setProductId] = useState("");

  const recognizeText = async (dataUrl: string): Promise<{ text: string; confidence: number }> => {
    // Try local assets first
    try {
      const result = await Tesseract.recognize(dataUrl, "eng", {
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        tessedit_pageseg_mode: "6",
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/tesseract-core.wasm.js",
        langPath: "/tesseract",
        logger: (m: any) => {
          if (m?.status) console.info("[OCR]", m.status, m.progress ?? "");
        },
      } as any);
      const text = (result?.data?.text || "").replace(/\s+/g, " ").trim();
      const conf = typeof result?.data?.confidence === "number" ? result.data.confidence : 0;
      return { text, confidence: conf };
    } catch (e) {
      console.warn("[OCR] Local assets failed, falling back to CDN", e);
      toast.message("Using online OCR assets", { description: "Local Tesseract files not found. Falling back to CDN." });
      const result = await Tesseract.recognize(dataUrl, "eng", {
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        tessedit_pageseg_mode: "6",
        workerPath: "https://unpkg.com/tesseract.js@5.0.5/dist/worker.min.js",
        corePath: "https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0_best",
        logger: (m: any) => {
          if (m?.status) console.info("[OCR/CDN]", m.status, m.progress ?? "");
        },
      } as any);
      const text = (result?.data?.text || "").replace(/\s+/g, " ").trim();
      const conf = typeof result?.data?.confidence === "number" ? result.data.confidence : 0;
      return { text, confidence: conf };
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image is too large (max 10MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        // First pass on original image
        let { text, confidence } = await recognizeText(dataUrl);
        setOcrText(text);
        setConfidence(confidence);
        let { batch, expiry } = extractFromOcrText(text);
        // If not found or low confidence, try variants
        if ((!batch && !expiry) || confidence < 40) {
          const variants = await createOcrVariants(dataUrl);
          for (const v of variants) {
            const cand = await recognizeText(v);
            if (cand.confidence > confidence) {
              confidence = cand.confidence;
              text = cand.text;
              setOcrText(text);
              setConfidence(confidence);
            }
            const ex = extractFromOcrText(cand.text);
            if (ex.batch || ex.expiry) {
              batch = ex.batch || batch;
              expiry = ex.expiry || expiry;
              break;
            }
          }
        }
        setBatchCode(batch || "");
        setExpiryDate(expiry || "");
        if (!text) {
          toast.warning("Could not read text. Try a clearer photo or manual entry.");
        } else if (confidence < 40 && !(batch || expiry)) {
          toast.message("Low OCR confidence", { description: "Try a clearer photo, crop to label area, or rotate." });
        } else {
          toast.success("OCR complete");
        }
      } catch (e) {
        console.error(e);
        toast.error("Label analysis failed");
      }
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!productId && !batchCode && !expiryDate) {
      toast.error("Enter at least product, batch or expiry");
      return;
    }
    // TODO: Integrate with backend once endpoint is available
    toast.success("Label captured (not yet persisted)");
  };

  return (
    <AppLayout container>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
          <p className="text-muted-foreground">Scan or create product labels.</p>
        </div>
      </div>
      <div className="mt-2">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition ${activeTab === 'scan' ? 'bg-background text-foreground shadow' : ''}`}
            onClick={() => setActiveTab('scan')}
            type="button"
          >
            Scan
          </button>
          <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition ${activeTab === 'manual' ? 'bg-background text-foreground shadow' : ''}`}
            onClick={() => setActiveTab('manual')}
            type="button"
          >
            Manual Entry
          </button>
        </div>
      </div>
      {activeTab === 'scan' && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan Label Image</CardTitle>
              <CardDescription>Upload a label photo to extract text, batch, and expiry.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Upload Image</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileSelected(f);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OCR Confidence</Label>
                  <Input readOnly value={confidence ? `${confidence.toFixed(1)}%` : ""} />
                </div>
                <div className="space-y-2">
                  <Label>Batch Code</Label>
                  <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="e.g., BATCH-12345" />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Recognized Text</Label>
                <textarea className="w-full h-32 rounded-md border p-2 text-sm" value={ocrText} onChange={(e) => setOcrText(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSave}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {activeTab === 'manual' && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>Enter label details without scanning.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-1">
                <Label>Product ID or Name</Label>
                <Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="e.g., PROD-ABC123" />
              </div>
              <div className="space-y-2">
                <Label>Batch Code</Label>
                <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="e.g., BATCH-12345" />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Button onClick={handleSave}>Save</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
