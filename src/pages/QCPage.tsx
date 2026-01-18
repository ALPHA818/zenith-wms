import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, Package, TruckIcon, Plus, ClipboardCheck, Eye, Scan as ScanIcon, Camera } from "lucide-react";
import { VehicleInspectionFormSheet } from "@/components/wms/VehicleInspectionFormSheet";
import { Shipment, VehicleInspectionFormData, VehicleInspection, Product, Pallet, Location } from "@shared/types";
import { api } from "@/lib/api-client";
import { toast, Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import jsQR from "jsqr";
// OCR for document labels
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Tesseract from "tesseract.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function QCPage() {
  const [activeTab, setActiveTab] = useState<"receiving" | "dispatch" | "completed">("receiving");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<{ type: 'dispatch' | 'receiving', data: VehicleInspection, shipment: Shipment } | null>(null);
  const user = useAuthStore((state) => state.user);

  // Product label scanning state
  const [labelInput, setLabelInput] = useState("");
  const [labelMode, setLabelMode] = useState<'dispatch' | 'receiving'>("receiving");
  const [cameraScanning, setCameraScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputSecondRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [strictMatch, setStrictMatch] = useState(true);
  const [labelDetails, setLabelDetails] = useState<{
    product: Product;
    batchCode?: string;
    expiryDate?: string;
    isMixedBatch: boolean;
    otherProducts: { name: string; quantity: number }[];
    palletId?: string;
  } | null>(null);
  const [casesCount, setCasesCount] = useState<number>(1);
  const [secondLabelInput, setSecondLabelInput] = useState("");
  const [secondDetails, setSecondDetails] = useState<{
    product: Product;
    batchCode?: string;
    expiryDate?: string;
  } | null>(null);
  const [inventory, setInventory] = useState<Product[] | null>(null);

  // New product creation confirmation
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [newProductCandidate, setNewProductCandidate] = useState<{
    id: string;
    name: string;
    expiryDate?: string;
  } | null>(null);
  const [confirmCreateSecondOpen, setConfirmCreateSecondOpen] = useState(false);
  const [secondProductCandidate, setSecondProductCandidate] = useState<{
    id: string;
    name: string;
    expiryDate?: string;
  } | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [newProductForm, setNewProductForm] = useState<{
    id: string;
    name: string;
    category: string;
    locationId: string;
    expiryDate: string; // yyyy-mm-dd
    quantity: number;
  }>({ id: "", name: "", category: "Uncategorized", locationId: "D01A", expiryDate: "", quantity: 0 });
  const [secondProductForm, setSecondProductForm] = useState<{
    id: string;
    name: string;
    category: string;
    locationId: string;
    expiryDate: string; // dd/mm/yyyy
    quantity: number;
  }>({ id: "", name: "", category: "Uncategorized", locationId: "D01A", expiryDate: "", quantity: 0 });

  // Helpers to normalize dates to dd/mm/yyyy for UI, and ISO for saving
  const formatDateToDdMmYyyy = (dt: Date): string => {
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  };
  const toDateInput = (raw?: string): string => {
    if (!raw) return "";
    const s = raw.trim();
    // Already dd/mm/yyyy or dd-mm-yyyy
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [_, d, mo, y] = m;
      if (y.length === 2) y = `20${y}`; // assume 20xx
      return `${String(Number(d)).padStart(2, '0')}/${String(Number(mo)).padStart(2, '0')}/${y}`;
    }
    // yyyy-mm-dd
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const [_, y, mo, d] = m;
      return `${String(Number(d)).padStart(2, '0')}/${String(Number(mo)).padStart(2, '0')}/${y}`;
    }
    // mm/dd/yyyy
    m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/]((?:19|20)\d{2})$/);
    if (m) {
      const [_, mo, d, y] = m;
      return `${String(Number(d)).padStart(2, '0')}/${String(Number(mo)).padStart(2, '0')}/${y}`;
    }
    // dd Mon yyyy or dd Month yy
    const monMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    const m2 = s.match(/^(\d{1,2})\s*([A-Za-z]{3,5})\s*(\d{2,4})$/);
    if (m2) {
      let [_, d, mon, y] = m2;
      const mo = monMap[mon.toLowerCase()];
      if (mo) {
        if (y.length === 2) y = `20${y}`;
        return `${String(Number(d)).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
      }
    }
    // Fallback: try Date.parse and format to dd/mm/yyyy
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return formatDateToDdMmYyyy(dt);
    }
    return "";
  };
  const parseUiDateToIso = (ui: string | undefined): string | null => {
    if (!ui) return null;
    const s = ui.trim();
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [_, d, mo, y] = m;
      if (y.length === 2) y = `20${y}`;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      if (!isNaN(dt.getTime())) return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString();
    }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const [_, y, mo, d] = m;
      const dt = new Date(Number(y), Number(mo) - 1, Number(d));
      if (!isNaN(dt.getTime())) return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString();
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString();
    return null;
  };

  // OCR helpers: image preprocessing and field normalization
  const preprocessCanvasForOCR = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, invert = false): string => {
    const maxDim = 1600;
    const w0 = canvas.width;
    const h0 = canvas.height;
    const scale = Math.min(maxDim / Math.max(w0, h0), 2);
    let workCanvas: HTMLCanvasElement = canvas;
    let workCtx: CanvasRenderingContext2D = ctx;
    if (scale > 1.05) {
      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = 'high';
      octx.drawImage(canvas, 0, 0, w, h);
      workCanvas = off; workCtx = octx;
    }
    const img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const data = img.data;
    // grayscale + mean luminance
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
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
    workCtx.putImageData(img, 0, 0);
    return workCanvas.toDataURL('image/png');
  };

  const recognizeText = async (dataUrl: string): Promise<{ text: string; confidence: number }> => {
    const result = await Tesseract.recognize(
      dataUrl,
      'eng',
      {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_pageseg_mode: '6'
      }
    );
    const text = (result?.data?.text || '').replace(/\s+/g, ' ').trim();
    const confidence = typeof result?.data?.confidence === 'number' ? result.data.confidence : 0;
    return { text, confidence };
  };

  const createOcrVariants = async (srcDataUrl: string): Promise<string[]> => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
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
    // Try a small set of robust variants
    return [
      makeVariant(0, false),
      makeVariant(0, true),
      makeVariant(90, false),
      makeVariant(270, false),
    ];
  };

  const findBestOcrText = async (initialDataUrl: string): Promise<{ text: string; confidence: number }> => {
    let best = await recognizeText(initialDataUrl);
    const good = (t: string) => {
      const { batch, expiry } = extractFromOcrText(t);
      return !!(batch || expiry) || /PROD-[A-Z0-9\-]+/i.test(t);
    };
    if (good(best.text)) return best;
    try {
      const variants = await createOcrVariants(initialDataUrl);
      for (const v of variants) {
        const cand = await recognizeText(v);
        if (cand.confidence > best.confidence) best = cand;
        if (good(cand.text)) return cand;
      }
    } catch {}
    return best;
  };

  const normalizeBatchCode = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    let s = raw.trim().toUpperCase();
    s = s.replace(/[^A-Z0-9\-\/]/g, '');
    s = s
      .replace(/(?<=\d)O(?=\d)/g, '0')
      .replace(/(?<=\d)I(?=\d)/g, '1')
      .replace(/(?<=\d)S(?=\d)/g, '5')
      .replace(/(?<=\d)B(?=\d)/g, '8')
      .replace(/(?<=\d)Z(?=\d)/g, '2');
    return s;
  };

  const extractFromOcrText = (text: string): { batch?: string; expiry?: string; nameGuess?: string } => {
    const t = text.replace(/\s+/g, ' ').trim();
    const batchMatch = t.match(/(?:BATCH(?:\s*CODE)?|LOT(?:\s*NO)?)[^\w]{0,3}([A-Z0-9][A-Z0-9\-\/]{2,})\b/i);
    const dateLabeled = t.match(/(?:EXP|Expiry|Best\s*Before|Use\s*By|BBE)[\s:]*([^\s,;]{3,})/i)?.[1];
    const dateRaw = dateLabeled || (t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)?.[1]) || (t.match(/(\d{4}-\d{1,2}-\d{1,2})/)?.[1]) || (t.match(/(\d{1,2}\s*[A-Za-z]{3,5}\s*\d{2,4})/)?.[1]);
    const tokens = t.split(/\s+/);
    const stopIdx = tokens.findIndex(x => /^(batch|lot|exp|expiry|bbe|use|best)$/i.test(x));
    const nameGuess = (stopIdx > 0 ? tokens.slice(0, Math.min(stopIdx, 6)) : tokens.slice(0, 6)).join(' ').replace(/[^A-Za-z0-9 \-]/g, '').trim();
    return { batch: normalizeBatchCode(batchMatch?.[1]), expiry: toDateInput(dateRaw), nameGuess: nameGuess || undefined };
  };

  const findProductByText = (products: Product[], text: string): Product | null => {
    const t = text.toLowerCase();
    const tokens = t.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^(batch|lot|exp|expiry|bbe|best|before|use|by)$/i.test(w));
    if (tokens.length === 0) return null;
    const scored: { id: string; score: number }[] = [];
    for (const p of products) {
      const nameTokens = p.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
      let score = 0;
      for (const tk of tokens) if (nameTokens.includes(tk)) score += 1;
      if (score > 0) scored.push({ id: p.id, score });
    }
    scored.sort((a,b) => b.score - a.score);
    if (scored.length === 1 && scored[0].score >= 2) {
      return products.find(p => p.id === scored[0].id) || null;
    }
    if (scored.length >= 2 && scored[0].score >= 3 && (scored[0].score - scored[1].score) >= 2) {
      return products.find(p => p.id === scored[0].id) || null;
    }
    return null;
  };

  // Parse structured codes (QR or typed) like JSON or URL with query params
  const parseStructuredCode = (raw: string): { id?: string; name?: string; batch?: string; expiry?: string } | null => {
    const s = raw.trim();
    // JSON payload
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('"{') && s.endsWith('}"'))) {
      try {
        const obj = JSON.parse(s.replace(/^"|"$/g, ''));
        const id = typeof obj.id === 'string' ? obj.id : undefined;
        const name = typeof obj.name === 'string' ? obj.name : undefined;
        const batch = typeof obj.batch === 'string' ? obj.batch : (typeof obj.batchCode === 'string' ? obj.batchCode : undefined);
        const expiry = typeof obj.expiry === 'string' ? obj.expiry : (typeof obj.expiryDate === 'string' ? obj.expiryDate : undefined);
        return { id, name, batch: normalizeBatchCode(batch), expiry: toDateInput(expiry) };
      } catch {}
    }
    // URL with query params
    try {
      const u = new URL(s);
      const id = u.searchParams.get('id') || undefined;
      const name = u.searchParams.get('name') || undefined;
      const batch = u.searchParams.get('batch') || u.searchParams.get('batchCode') || undefined;
      const expiry = u.searchParams.get('exp') || u.searchParams.get('expiry') || u.searchParams.get('expiryDate') || undefined;
      if (id || name || batch || expiry) {
        return { id: id || undefined, name: name || undefined, batch: normalizeBatchCode(batch || undefined), expiry: toDateInput(expiry || undefined) };
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    if (confirmCreateOpen || confirmCreateSecondOpen) {
      // Load locations once when dialog opens
      (async () => {
        try {
          const locs = await api<Location[]>('/api/wms/locations');
          setLocations(locs);
        } catch (e) {
          // ignore, fallback to default D01A
        }
      })();
    }
  }, [confirmCreateOpen, confirmCreateSecondOpen]);

  useEffect(() => {
    if (labelDialogOpen && !inventory) {
      (async () => {
        try {
          const prods = await api<Product[]>('/api/wms/inventory');
          setInventory(prods);
        } catch {}
      })();
    }
  }, [labelDialogOpen, inventory]);

  useEffect(() => {
    if (newProductCandidate) {
      const iso = toDateInput(newProductCandidate.expiryDate);
      setNewProductForm({
        id: newProductCandidate.id,
        name: newProductCandidate.name,
        category: "Uncategorized",
        locationId: "D01A",
        expiryDate: iso,
        quantity: Math.max(1, casesCount),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newProductCandidate]);

  useEffect(() => {
    if (secondProductCandidate) {
      const iso = toDateInput(secondProductCandidate.expiryDate);
      setSecondProductForm({
        id: secondProductCandidate.id,
        name: secondProductCandidate.name,
        category: "Uncategorized",
        locationId: "D01A",
        expiryDate: iso,
        quantity: Math.max(1, casesCount),
      });
    }
  }, [secondProductCandidate]);

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<Shipment[]>('/api/wms/shipments');
      setShipments(data);
    } catch (error) {
      toast.error("Failed to fetch shipments.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Keep label mode aligned with current tab (if not 'completed')
  useEffect(() => {
    if (activeTab === 'dispatch' || activeTab === 'receiving') {
      setLabelMode(activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    // Cleanup camera and intervals on unmount
    return () => stopCameraScan();
  }, []);

  const handleInspection = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsInspectionOpen(true);
  };

  const handleInspectionSubmit = async (
    shipmentId: string,
    type: 'dispatch' | 'receiving',
    data: VehicleInspectionFormData
  ) => {
    try {
      const endpoint = type === 'dispatch'
        ? `/api/wms/shipments/${shipmentId}/dispatch-inspection`
        : `/api/wms/shipments/${shipmentId}/receiving-inspection`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (user) {
        headers['X-User-Id'] = user.id;
        headers['X-User-Name'] = user.name;
      }

      await api<Shipment>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
      });

      toast.success(`${type === 'dispatch' ? 'Dispatch' : 'Receiving'} inspection completed successfully.`);
      setIsInspectionOpen(false);
      fetchShipments();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to save inspection.";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  const getRelevantShipments = () => {
    if (activeTab === 'receiving') {
      // Show all shipments that need or have had receiving inspection
      return shipments.filter(s => 
        s.status === 'In Transit' || s.status === 'Delivered'
      );
    } else if (activeTab === 'dispatch') {
      // Show all shipments that need or have had dispatch inspection
      return shipments.filter(s => 
        s.status === 'Preparing' || s.status === 'In Transit'
      );
    } else {
      // Show all shipments that have either dispatch or receiving inspections
      return shipments.filter(s => s.dispatchInspection || s.receivingInspection);
    }
  };

  const handleViewInspection = (type: 'dispatch' | 'receiving', data: VehicleInspection, shipment: Shipment) => {
    setSelectedInspection({ type, data, shipment });
    setInspectionDialogOpen(true);
  };

  const relevantShipments = getRelevantShipments();

  const startCameraScan = async () => {
    try {
      setCameraScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        toast.info("Camera on - scan product label QR");
        scanIntervalRef.current = window.setInterval(() => scanQRCode(), 500);
      }
    } catch (e) {
      console.error(e);
      toast.error("Cannot access camera. Check permissions.");
      setCameraScanning(false);
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setCameraScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code) {
      stopCameraScan();
      setLabelInput(code.data);
      handleLabelScan(code.data);
    }
  };

  const captureFrameDataUrl = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  };

  const analyzeLabelImage = async (dataUrl: string) => {
    try {
      const { text } = await findBestOcrText(dataUrl);
      if (!text) {
        toast.warning('Could not read label text. Try again.');
        return;
      }
      // Parse fields with stronger heuristics
      const { batch, expiry, nameGuess } = extractFromOcrText(text);
      const productCodeMatch = text.match(/PROD-[A-Z0-9\-]+/i);

          const products = await api<Product[]>('/api/wms/inventory');
      let product: Product | undefined;
      if (productCodeMatch) {
        const code = productCodeMatch[0].toUpperCase();
        product = products.find(p => p.id.toUpperCase() === code);
      }
      if (!product && !strictMatch) {
        // Conservative fuzzy by token overlap (only if not strict)
        product = findProductByText(products, text);
      }
      if (!product) {
        // Prepare a creation proposal and ask for confirmation
        const inferredName = nameGuess || 'New Product';
        const inferredId = (batch || productCodeMatch?.[0]?.toUpperCase()) || `BATCH-${Date.now().toString().slice(-6)}`;
        const inferredExpiry = expiry;
        setLabelInput(inferredId);
        setNewProductCandidate({ id: inferredId, name: inferredName, expiryDate: inferredExpiry });
        setConfirmCreateOpen(true);
        return;
      }

      const pallets = await api<Pallet[]>('/api/wms/pallets');
      const pallet = pallets.find(pl => pl.products.some(pp => pp.id === product!.id));
      const entry = pallet?.products.find(pp => pp.id === product!.id);
      const batchCode = normalizeBatchCode(batch) || entry?.batchCode;
      const expiryDate = (expiry && parseUiDateToIso(expiry)) || entry?.expiryDate || product.expiryDate;
      const isMixedBatch = !!pallet && new Set(pallet.products.map(pp => pp.id)).size > 1;
      const otherProducts = pallet ? pallet.products.filter(pp => pp.id !== product!.id).map(pp => ({ name: pp.name, quantity: pp.quantity })) : [];

      setLabelDetails({ product, batchCode, expiryDate, isMixedBatch, otherProducts, palletId: pallet?.id });
      setCasesCount(1);
      setLabelDialogOpen(true);
      // Show a short OCR snippet for debugging/verification
      const snippet = text.slice(0, 120);
      toast.message('OCR extracted', { description: snippet + (text.length > 120 ? '…' : '') });
    } catch (e) {
      console.error(e);
      toast.error('Label analysis failed');
    }
  };

  const processLabelImageDataUrl = async (dataUrl: string) => {
    try {
      // Draw image to hidden canvas
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });
      const canvas = canvasRef.current;
      if (!canvas) return analyzeLabelImage(dataUrl);
      const ctx = canvas.getContext('2d');
      if (!ctx) return analyzeLabelImage(dataUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      // Try QR first
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (qr && qr.data) {
        setLabelInput(qr.data);
        await handleLabelScan(qr.data);
        return;
      }
      // Fallback to OCR with preprocessing for better accuracy
      const preUrl = preprocessCanvasForOCR(canvas, ctx);
      await analyzeLabelImage(preUrl);
    } catch (e) {
      console.error(e);
      toast.error('Failed to process image.');
    }
  };

  const handleFileSelected = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await processLabelImageDataUrl(dataUrl);
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsDataURL(file);
  };

  const processSecondImageDataUrl = async (dataUrl: string) => {
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });
      const canvas = canvasRef.current;
      if (!canvas) return analyzeSecondImage(dataUrl);
      const ctx = canvas.getContext('2d');
      if (!ctx) return analyzeSecondImage(dataUrl);
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (qr && qr.data) {
        setSecondLabelInput(qr.data);
        await handleSecondLabelScan(qr.data);
        return;
      }
      const preUrl = preprocessCanvasForOCR(canvas, ctx);
      await analyzeSecondImage(preUrl);
    } catch (e) {
      console.error(e);
      toast.error('Failed to process second image.');
    }
  };

  const analyzeSecondImage = async (dataUrl: string) => {
    try {
      const { text } = await findBestOcrText(dataUrl);
      if (!text) {
        toast.warning('Could not read second label text.');
        return;
      }
      const { batch, expiry } = extractFromOcrText(text);
      const productCodeMatch = text.match(/PROD-[A-Z0-9\-]+/i);
      const numMatch = text.match(/\b\d{6,12}\b/);
      const code = (batch || productCodeMatch?.[0] || numMatch?.[0] || '').toUpperCase();
      if (code) {
        setSecondLabelInput(code);
        await handleSecondLabelScan(code);
      } else {
        // Try fuzzy by product name from inventory
        try {
          const products = await api<Product[]>('/api/wms/inventory');
          const product = strictMatch ? null : findProductByText(products, text);
          if (product) {
            setSecondLabelInput(product.id);
            // Populate details from pallets
            const pallets = await api<Pallet[]>('/api/wms/pallets');
            const pallet = pallets.find(pl => pl.products.some(pp => pp.id === product.id));
            const entry = pallet?.products.find(pp => pp.id === product.id);
            const batchCode = normalizeBatchCode(entry?.batchCode);
            const expiryDate = (expiry && parseUiDateToIso(expiry)) || entry?.expiryDate || product.expiryDate;
            setSecondDetails({ product, batchCode, expiryDate });
            toast.info('Inferred second product by name match');
            return;
          }
        } catch {}
        // No identifier resolved: offer to create a new second product
        const extracted = extractFromOcrText(text);
        const inferredName = extracted.nameGuess || 'New Product';
        const inferredExpiry = extracted.expiry;
        const generatedId = `BATCH-${Date.now().toString().slice(-6)}`;
        setSecondProductCandidate({ id: generatedId, name: inferredName, expiryDate: inferredExpiry });
        setConfirmCreateSecondOpen(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Second label analysis failed');
    }
  };

  const handleFileSelectedSecond = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await processSecondImageDataUrl(dataUrl);
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsDataURL(file);
  };

  const handleSecondLabelScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const products = await api<Product[]>('/api/wms/inventory');
      let product = products.find(p => p.id === trimmed || p.name === trimmed);
      if (!product && !strictMatch) {
        // Conservative fuzzy by token overlap
        const guessed = findProductByText(products, trimmed);
        if (guessed) {
          product = guessed;
          toast.info('Matched second product by name');
        }
      }
      if (!product) {
        // Offer to create second product from this code
        setSecondProductCandidate({ id: trimmed.toUpperCase(), name: trimmed });
        setConfirmCreateSecondOpen(true);
        return;
      }
      const pallets = await api<Pallet[]>('/api/wms/pallets');
      const pallet = pallets.find(pl => pl.products.some(pp => pp.id === product.id));
      const entry = pallet?.products.find(pp => pp.id === product.id);
      const batchCode = entry?.batchCode;
      const expiryDate = entry?.expiryDate || product.expiryDate;
      setSecondDetails({ product, batchCode, expiryDate });
      toast.success(`Second label scanned: ${product.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to process second label');
    }
  };

  const handleLabelScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      // First, parse structured QR (JSON/URL) if present
      const structured = parseStructuredCode(trimmed);
      const productCode = structured?.id || trimmed; // treat as batch code or SKU if id missing
      const products = await api<Product[]>('/api/wms/inventory');
      const product = products.find(p => p.id === productCode || p.name === productCode);
      if (!product) {
        // Ask to create a new product from this label (assume this is the Batch Code)
        const candidateId = (structured?.batch || productCode).toUpperCase();
        setNewProductCandidate({ id: candidateId, name: structured?.name || trimmed, expiryDate: structured?.expiry });
        setConfirmCreateOpen(true);
        return;
      }
      // Find a pallet containing this product to retrieve batch/expiry and mixed info
      const pallets = await api<Pallet[]>('/api/wms/pallets');
      const pallet = pallets.find(pl => pl.products.some(pp => pp.id === product.id));
      let batchCode: string | undefined;
      let expiryDate: string | undefined = product.expiryDate;
      let isMixedBatch = false;
      let otherProducts: { name: string; quantity: number }[] = [];
      if (pallet) {
        const entry = pallet.products.find(pp => pp.id === product.id);
        batchCode = entry?.batchCode || structured?.batch;
        expiryDate = structured?.expiry ? parseUiDateToIso(structured.expiry) || entry?.expiryDate || expiryDate : entry?.expiryDate || expiryDate;
        isMixedBatch = new Set(pallet.products.map(pp => pp.id)).size > 1;
        otherProducts = pallet.products
          .filter(pp => pp.id !== product.id)
          .map(pp => ({ name: pp.name, quantity: pp.quantity }));
      }
      setLabelDetails({ product, batchCode, expiryDate, isMixedBatch, otherProducts, palletId: pallet?.id });
      setLabelDialogOpen(true);
      toast.success(`Label scanned: ${product.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to process label scan');
    }
  };

  return (
    <AppLayout container>
      <PageHeader 
        title="Quality Control" 
        subtitle="Manage quality checks for receiving and dispatch operations"
      />

      {/* Product Label Scan */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanIcon className="h-5 w-5" />
            Product Label Scan
          </CardTitle>
          <CardDescription>Scan a product label to view batch and expiry details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="w-64">
              <Label htmlFor="label-mode">Context</Label>
              <Select value={labelMode} onValueChange={(v) => setLabelMode(v as 'dispatch' | 'receiving')}>
                <SelectTrigger id="label-mode">
                  <SelectValue placeholder="Select context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receiving">Receiving</SelectItem>
                  <SelectItem value="dispatch">Dispatch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Checkbox id="strict-match" checked={strictMatch} onCheckedChange={(c) => setStrictMatch(!!c)} />
              <Label htmlFor="strict-match">Strict matching (no fuzzy)</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="label-input">Label Code / QR</Label>
              <Input
                id="label-input"
                type="text"
                placeholder="Scan or type product code (e.g., PROD-00001)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLabelScan(labelInput)}
                className="font-mono mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => handleLabelScan(labelInput)} className="gap-2" disabled={!labelInput.trim()}>
                <ScanIcon className="h-4 w-4" />
                Lookup
              </Button>
              <Button variant="outline" className="gap-2" onClick={cameraScanning ? stopCameraScan : startCameraScan}>
                <Camera className="h-4 w-4" />
                {cameraScanning ? 'Stop' : 'Camera On'}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  // reset value so selecting same file triggers change again
                  if (e.target) e.target.value = '' as any;
                }}
              />
            </div>
          </div>
          {/* Hidden canvas for processing uploaded images and camera frames */}
          <canvas ref={canvasRef} className="hidden" />
          {cameraScanning && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-56 object-cover" playsInline />
                <div className="absolute inset-0 border-4 border-primary/30 pointer-events-none" />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const dataUrl = captureFrameDataUrl();
                    if (dataUrl) analyzeLabelImage(dataUrl);
                    else toast.warning('No frame captured');
                  }}
                >
                  Capture & Analyze Label
                </Button>
                <Button variant="outline" onClick={() => {
                  const dataUrl = captureFrameDataUrl();
                  if (dataUrl) {
                    // Try QR first; if not found, do OCR
                    processLabelImageDataUrl(dataUrl);
                  }
                }}>Try QR then OCR</Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">Point camera at the physical label, then tap Capture & Analyze.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "receiving" | "dispatch" | "completed")} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="receiving" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Receiving
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4" />
            Dispatch
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receiving" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Receiving Quality Control
              </CardTitle>
              <CardDescription>
                Inspect and verify incoming shipments and raw materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : relevantShipments.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center space-y-2">
                    <CheckCircle className="h-12 w-12 mx-auto opacity-50" />
                    <p className="text-lg font-medium">No Pending Receiving Inspections</p>
                    <p className="text-sm">All incoming shipments have been inspected</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relevantShipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.id}</TableCell>
                        <TableCell>{shipment.orderId}</TableCell>
                        <TableCell>{shipment.carrier}</TableCell>
                        <TableCell>
                          <Badge variant={shipment.status === 'Delivered' ? 'default' : 'secondary'}>
                            {shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {shipment.receivingInspection ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInspection('receiving', shipment.receivingInspection!, shipment)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleInspection(shipment)}
                              className="gap-2"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                              Inspect
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispatch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5" />
                Dispatch Quality Control
              </CardTitle>
              <CardDescription>
                Final inspection before shipment departure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : relevantShipments.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center space-y-2">
                    <CheckCircle className="h-12 w-12 mx-auto opacity-50" />
                    <p className="text-lg font-medium">No Pending Dispatch Inspections</p>
                    <p className="text-sm">All outgoing shipments have been inspected</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relevantShipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">{shipment.id}</TableCell>
                        <TableCell>{shipment.orderId}</TableCell>
                        <TableCell>{shipment.carrier}</TableCell>
                        <TableCell>
                          <Badge variant={shipment.status === 'Preparing' ? 'secondary' : 'default'}>
                            {shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {shipment.dispatchInspection ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewInspection('dispatch', shipment.dispatchInspection!, shipment)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleInspection(shipment)}
                              className="gap-2"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                              Inspect
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Completed Inspections
              </CardTitle>
              <CardDescription>
                View all completed vehicle inspections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : relevantShipments.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center space-y-2">
                    <CheckCircle className="h-12 w-12 mx-auto opacity-50" />
                    <p className="text-lg font-medium">No Completed Inspections</p>
                    <p className="text-sm">Inspection records will appear here</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relevantShipments.map((shipment) => {
                      const inspection = shipment.dispatchInspection || shipment.receivingInspection;
                      const inspectionType = shipment.dispatchInspection ? 'Dispatch' : 'Receiving';
                      return (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-medium">{shipment.id}</TableCell>
                          <TableCell>{shipment.orderId}</TableCell>
                          <TableCell>
                            <Badge variant={inspectionType === 'Dispatch' ? 'default' : 'secondary'}>
                              {inspectionType}
                            </Badge>
                          </TableCell>
                          <TableCell>{inspection?.inspectorName || 'Unknown'}</TableCell>
                          <TableCell>
                            {inspection?.inspectionDate 
                              ? new Date(inspection.inspectionDate).toLocaleString()
                              : 'N/A'
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const inspType = inspectionType.toLowerCase() as 'dispatch' | 'receiving';
                                handleViewInspection(inspType, inspection!, shipment);
                              }}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedShipment && (activeTab === 'dispatch' || activeTab === 'receiving') && (
        <VehicleInspectionFormSheet
          isOpen={isInspectionOpen}
          onClose={() => {
            setIsInspectionOpen(false);
            setSelectedShipment(null);
          }}
          onSubmit={handleInspectionSubmit}
          inspectionType={activeTab}
          shipmentId={selectedShipment.id}
          orderId={selectedShipment.orderId}
        />
      )}

      <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedInspection?.type === 'dispatch' ? 'Dispatch' : 'Receiving'} Inspection Details
            </DialogTitle>
            <DialogDescription>
              Completed by {selectedInspection?.data.inspectorName} on{' '}
              {selectedInspection?.data.inspectionDate && new Date(selectedInspection.data.inspectionDate).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedInspection && (
            <div className="space-y-6 py-4">
              {/* Vehicle Condition */}
              <div>
                <h3 className="font-semibold mb-3">Vehicle Interior Condition</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.hasHoles ? "destructive" : "secondary"}>
                      {selectedInspection.data.hasHoles ? "✗" : "✓"}
                    </Badge>
                    <span className="text-sm">Has Holes: {selectedInspection.data.hasHoles ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.isWet ? "destructive" : "secondary"}>
                      {selectedInspection.data.isWet ? "✗" : "✓"}
                    </Badge>
                    <span className="text-sm">Is Wet: {selectedInspection.data.isWet ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.isClean ? "secondary" : "destructive"}>
                      {selectedInspection.data.isClean ? "✓" : "✗"}
                    </Badge>
                    <span className="text-sm">Is Clean: {selectedInspection.data.isClean ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.hasDamage ? "destructive" : "secondary"}>
                      {selectedInspection.data.hasDamage ? "✗" : "✓"}
                    </Badge>
                    <span className="text-sm">Has Damage: {selectedInspection.data.hasDamage ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.hasOdor ? "destructive" : "secondary"}>
                      {selectedInspection.data.hasOdor ? "✗" : "✓"}
                    </Badge>
                    <span className="text-sm">Has Odor: {selectedInspection.data.hasOdor ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInspection.data.temperatureOk ? "secondary" : "destructive"}>
                      {selectedInspection.data.temperatureOk ? "✓" : "✗"}
                    </Badge>
                    <span className="text-sm">Temperature OK: {selectedInspection.data.temperatureOk ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Driver & Vehicle Info */}
              <div>
                <h3 className="font-semibold mb-3">Driver & Vehicle Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver Name:</span>
                    <span className="font-medium">{selectedInspection.data.driverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle Registration:</span>
                    <span className="font-medium">{selectedInspection.data.vehicleRegistration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Documentation:</span>
                    <span className="font-medium">{selectedInspection.data.orderDocumentationNumber}</span>
                  </div>
                  {selectedInspection.data.deliveryTime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Delivery Time:</span>
                      <span className="font-medium">{new Date(selectedInspection.data.deliveryTime).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedInspection.data.arrivalTime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arrival Time:</span>
                      <span className="font-medium">{new Date(selectedInspection.data.arrivalTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Products */}
              <div>
                <h3 className="font-semibold mb-3">Products ({selectedInspection.data.items.length})</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product ID</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInspection.data.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{item.productId}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              {selectedInspection.data.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Additional Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedInspection.data.notes}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Inspector Info */}
              <div className="bg-muted p-3 rounded-md">
                <h3 className="font-semibold mb-2 text-sm">Inspector Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inspector:</span>
                    <span className="font-medium">{selectedInspection.data.inspectorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inspector ID:</span>
                    <span className="font-mono text-xs">{selectedInspection.data.inspectedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date & Time:</span>
                    <span>{new Date(selectedInspection.data.inspectionDate).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Label Details Dialog */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Product Label Details</DialogTitle>
            <DialogDescription>Information extracted from the scanned label.</DialogDescription>
          </DialogHeader>
          {labelDetails && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold">{labelDetails.product.name}</span>
              </div>
              <div className="w-64">
                <Label htmlFor="dlg-label-mode">Context</Label>
                <Select value={labelMode} onValueChange={(v) => setLabelMode(v as 'dispatch' | 'receiving')}>
                  <SelectTrigger id="dlg-label-mode" className="mt-1">
                    <SelectValue placeholder="Select context" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receiving">Receiving</SelectItem>
                    <SelectItem value="dispatch">Dispatch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="dlg-product">Product</Label>
                      <Select
                        value={labelDetails.product.id}
                        onValueChange={async (val) => {
                          if (!inventory) return;
                          const prod = inventory.find(p => p.id === val);
                          if (!prod) return;
                          try {
                            const pallets = await api<Pallet[]>('/api/wms/pallets');
                            const pallet = pallets.find(pl => pl.products.some(pp => pp.id === prod.id));
                            const entry = pallet?.products.find(pp => pp.id === prod.id);
                            setLabelDetails(prev => prev ? {
                              ...prev,
                              product: prod,
                              batchCode: entry?.batchCode || prev.batchCode,
                              expiryDate: entry?.expiryDate || prev.expiryDate,
                              palletId: pallet?.id || prev.palletId,
                              otherProducts: pallet ? pallet.products.filter(pp => pp.id !== prod.id).map(pp => ({ name: pp.name, quantity: pp.quantity })) : prev.otherProducts,
                              isMixedBatch: !!pallet && new Set(pallet.products.map(pp => pp.id)).size > 1
                            } : prev);
                            toast.success('Product updated');
                          } catch {}
                        }}
                      >
                        <SelectTrigger id="dlg-product" className="mt-1">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72 overflow-auto">
                          {[labelDetails.product, ...(inventory || [])]
                            .filter((p, idx, arr) => arr.findIndex(q => q.id === p.id) === idx)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dlg-batch">Batch Code</Label>
                      <Input
                        id="dlg-batch"
                        className="font-mono"
                        value={labelDetails.batchCode || labelDetails.product.id}
                        onChange={(e) => setLabelDetails(prev => prev ? { ...prev, batchCode: e.target.value } : prev)}
                      />
                    </div>
                {labelDetails.palletId && (
                  <div>
                    <span className="text-muted-foreground">Pallet:</span>
                    <span className="ml-2 font-mono">{labelDetails.palletId}</span>
                  </div>
                )}
                    <div className="space-y-1">
                      <Label htmlFor="dlg-sku">SKU</Label>
                      <Input id="dlg-sku" value={labelDetails.product.id} readOnly />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dlg-exp">Expiry (dd/mm/yyyy)</Label>
                      <Input
                        id="dlg-exp"
                        placeholder="dd/mm/yyyy"
                        value={toDateInput(labelDetails.expiryDate)}
                        onChange={(e) => setLabelDetails(prev => prev ? { ...prev, expiryDate: e.target.value } : prev)}
                      />
                    </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mixed-batch"
                    checked={labelDetails.isMixedBatch}
                    onCheckedChange={(checked) => setLabelDetails(prev => prev ? { ...prev, isMixedBatch: !!checked } : prev)}
                  />
                  <Label htmlFor="mixed-batch">Mixed Batch</Label>
                </div>
              </div>
              {labelDetails.isMixedBatch && (
                <div>
                  <Separator className="my-2" />
                  <div className="text-xs text-muted-foreground mb-2">Add a label for the second product on this pallet:</div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor="second-label">Second Label Code / QR</Label>
                      <Input
                        id="second-label"
                        type="text"
                        placeholder="Enter code or name"
                        value={secondLabelInput}
                        onChange={(e) => setSecondLabelInput(e.target.value)}
                        className="font-mono mt-1"
                      />
                    </div>
                    <Button onClick={() => handleSecondLabelScan(secondLabelInput)} className="gap-2" disabled={!secondLabelInput.trim()}>
                      <ScanIcon className="h-4 w-4" />
                      Lookup
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => fileInputSecondRef.current?.click()}>
                      Upload Image
                    </Button>
                    <input
                      ref={fileInputSecondRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelectedSecond(f);
                        if (e.target) e.target.value = '' as any;
                      }}
                    />
                  </div>
                  {secondDetails && (
                    <div className="mt-3 p-3 rounded border">
                      <div className="font-semibold">Second Product</div>
                      <div className="text-sm mt-2 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input value={secondDetails.product.name} readOnly />
                        </div>
                        <div className="space-y-1">
                          <Label>SKU</Label>
                          <Input className="font-mono" value={secondDetails.product.id} readOnly />
                        </div>
                        <div className="space-y-1">
                          <Label>Batch Code</Label>
                          <Input
                            className="font-mono"
                            value={secondDetails.batchCode || ''}
                            onChange={(e) => setSecondDetails(prev => prev ? { ...prev, batchCode: e.target.value } : prev)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Expiry (dd/mm/yyyy)</Label>
                          <Input
                            placeholder="dd/mm/yyyy"
                            value={toDateInput(secondDetails.expiryDate)}
                            onChange={(e) => setSecondDetails(prev => prev ? { ...prev, expiryDate: e.target.value } : prev)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Separator className="my-2" />
              <div className="space-y-2">
                <Label htmlFor="cases">Cases</Label>
                <Input
                  id="cases"
                  type="number"
                  min={1}
                  className="w-28"
                  value={casesCount}
                  onChange={(e) => setCasesCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                />
                <p className="text-xs text-muted-foreground">Select the number of cases for this label.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Create New Product Dialog */}
      <Dialog open={confirmCreateOpen} onOpenChange={setConfirmCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create new product from label</DialogTitle>
            <DialogDescription>Review and edit details before saving.</DialogDescription>
          </DialogHeader>
          {newProductCandidate && (
            <div className="space-y-3 text-sm">
              <div>
                <Label htmlFor="np-sku">Batch Code</Label>
                <Input id="np-sku" placeholder="e.g. BATCH-2025-1216-001" className="font-mono mt-1" value={newProductForm.id} onChange={(e) => setNewProductForm(v => ({ ...v, id: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <Label htmlFor="np-name">Name</Label>
                <Input id="np-name" className="mt-1" value={newProductForm.name} onChange={(e) => setNewProductForm(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="np-category">Category</Label>
                <Input id="np-category" className="mt-1" value={newProductForm.category} onChange={(e) => setNewProductForm(v => ({ ...v, category: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="np-location">Location</Label>
                  <Select value={newProductForm.locationId} onValueChange={(v) => setNewProductForm(f => ({ ...f, locationId: v }))}>
                    <SelectTrigger id="np-location" className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {[newProductForm.locationId, ...locations.map(l => l.id)].filter((v, i, a) => a.indexOf(v) === i).map(id => (
                        <SelectItem key={id} value={id}>{id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="np-expiry">Expiry Date</Label>
                  <Input id="np-expiry" type="text" placeholder="dd/mm/yyyy" className="mt-1" value={newProductForm.expiryDate} onChange={(e) => setNewProductForm(v => ({ ...v, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="np-qty">Initial Quantity</Label>
                <Input id="np-qty" type="number" min={0} className="w-32 mt-1" value={newProductForm.quantity} onChange={(e) => setNewProductForm(v => ({ ...v, quantity: Math.max(0, parseInt(e.target.value || '0', 10)) }))} />
                <p className="text-xs text-muted-foreground mt-1">Defaults to scanned cases: {casesCount}.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!newProductCandidate) return;
                try {
                  const expiryIso = parseUiDateToIso(newProductForm.expiryDate)
                    || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
                  const payload = {
                    id: newProductForm.id.trim(),
                    name: newProductForm.name.trim(),
                    category: newProductForm.category.trim() || 'Uncategorized',
                    quantity: newProductForm.quantity,
                    locationId: newProductForm.locationId.trim() || 'D01A',
                    expiryDate: expiryIso,
                  };
                  await api<Product>('/api/wms/inventory', { method: 'POST', body: JSON.stringify(payload) });
                  toast.success('Product created');
                  setConfirmCreateOpen(false);
                  // Immediately show label details for the newly created product
                  const created: Product = payload as any;
                  setLabelDetails({ product: created, batchCode: undefined, expiryDate: created.expiryDate, isMixedBatch: false, otherProducts: [] });
                  setLabelDialogOpen(true);
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to create product');
                }
              }}
            >
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Create Second Product Dialog */}
      <Dialog open={confirmCreateSecondOpen} onOpenChange={setConfirmCreateSecondOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create second product from label</DialogTitle>
            <DialogDescription>Review and edit details before saving.</DialogDescription>
          </DialogHeader>
          {secondProductCandidate && (
            <div className="space-y-3 text-sm">
              <div>
                <Label htmlFor="np2-sku">Batch Code</Label>
                <Input id="np2-sku" placeholder="e.g. BATCH-2025-1216-002" className="font-mono mt-1" value={secondProductForm.id} onChange={(e) => setSecondProductForm(v => ({ ...v, id: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <Label htmlFor="np2-name">Name</Label>
                <Input id="np2-name" className="mt-1" value={secondProductForm.name} onChange={(e) => setSecondProductForm(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="np2-category">Category</Label>
                <Input id="np2-category" className="mt-1" value={secondProductForm.category} onChange={(e) => setSecondProductForm(v => ({ ...v, category: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="np2-location">Location</Label>
                  <Select value={secondProductForm.locationId} onValueChange={(v) => setSecondProductForm(f => ({ ...f, locationId: v }))}>
                    <SelectTrigger id="np2-location" className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {[secondProductForm.locationId, ...locations.map(l => l.id)].filter((v, i, a) => a.indexOf(v) === i).map(id => (
                        <SelectItem key={id} value={id}>{id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="np2-expiry">Expiry Date</Label>
                  <Input id="np2-expiry" type="text" placeholder="dd/mm/yyyy" className="mt-1" value={secondProductForm.expiryDate} onChange={(e) => setSecondProductForm(v => ({ ...v, expiryDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label htmlFor="np2-qty">Initial Quantity</Label>
                <Input id="np2-qty" type="number" min={0} className="w-32 mt-1" value={secondProductForm.quantity} onChange={(e) => setSecondProductForm(v => ({ ...v, quantity: Math.max(0, parseInt(e.target.value || '0', 10)) }))} />
                <p className="text-xs text-muted-foreground mt-1">Defaults to scanned cases: {casesCount}.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCreateSecondOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!secondProductCandidate) return;
                try {
                  const expiryIso = parseUiDateToIso(secondProductForm.expiryDate)
                    || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
                  const payload = {
                    id: secondProductForm.id.trim(),
                    name: secondProductForm.name.trim(),
                    category: secondProductForm.category.trim() || 'Uncategorized',
                    quantity: secondProductForm.quantity,
                    locationId: secondProductForm.locationId.trim() || 'D01A',
                    expiryDate: expiryIso,
                  };
                  await api<Product>('/api/wms/inventory', { method: 'POST', body: JSON.stringify(payload) });
                  toast.success('Second product created');
                  setConfirmCreateSecondOpen(false);
                  // Show second product details in the mixed batch section
                  const created: Product = payload as any;
                  setSecondDetails({ product: created, batchCode: undefined, expiryDate: created.expiryDate });
                  setSecondLabelInput(created.id);
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to create second product');
                }
              }}
            >
              Create Second Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors />
    </AppLayout>
  );
}
