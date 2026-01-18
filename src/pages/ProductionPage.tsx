import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { Product, ProductionEvent } from "@shared/types";
import { PlusCircle, RefreshCw, ChevronDown, ChevronRight, Eye, QrCode } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeDisplay } from "@/components/wms/QRCodeDisplay";
import { useNavigate } from "react-router-dom";

type LineItem = { productId: string; quantity: number; batchCode?: string; expiryDate?: string; supplier?: string; rawName?: string };

export function ProductionPage(): JSX.Element {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Simple raw lines list (no category grouping)
  const [rawLines, setRawLines] = useState<LineItem[]>([{ productId: "", quantity: 0 }]);
  const [outputLines, setOutputLines] = useState<LineItem[]>([{ productId: "", quantity: 0 }]);
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  // Production history state
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Batch dialog state
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchIndex, setBatchIndex] = useState<number | null>(null);
  const [batchCode, setBatchCode] = useState("");
  const [batchExpiry, setBatchExpiry] = useState("");
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [rawName, setRawName] = useState("");
  // QR dialog state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEventId, setQrEventId] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsEvent, setLabelsEvent] = useState<ProductionEvent | null>(null);
  const [selectedRunLabels, setSelectedRunLabels] = useState<Set<number>>(new Set());
  const [selectedEventLabels, setSelectedEventLabels] = useState<Set<number>>(new Set());

  const generateQRDataURL = (text: string, size: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    canvas.width = size;
    canvas.height = size;
    const margin = Math.max(8, Math.floor(size * 0.06));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);
    const modules = 25;
    const gridSize = size - margin * 2;
    const cell = gridSize / modules;
    const drawFinder = (gx: number, gy: number) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(margin + gx * cell, margin + gy * cell, cell * 7, cell * 7);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(margin + (gx + 1) * cell, margin + (gy + 1) * cell, cell * 5, cell * 5);
      ctx.fillStyle = '#000000';
      ctx.fillRect(margin + (gx + 2) * cell, margin + (gy + 2) * cell, cell * 3, cell * 3);
    };
    drawFinder(0, 0);
    drawFinder(modules - 7, 0);
    drawFinder(0, modules - 7);
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 131 + text.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xFFFFFFFF;
    };
    ctx.fillStyle = '#000000';
    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        const inTL = x < 7 && y < 7;
        const inTR = x >= modules - 7 && y < 7;
        const inBL = x < 7 && y >= modules - 7;
        if (inTL || inTR || inBL) continue;
        if (rand() < 0.35) {
          ctx.fillRect(margin + x * cell, margin + y * cell, cell - 0.8, cell - 0.8);
        }
      }
    }
    return canvas.toDataURL('image/png');
  };

  const printLabelsBatch = (labels: Array<{ title: string; info: Array<{ label: string; value: string }>; qrValue: string }>) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const style = `
      @media print {
        @page { size: 4in 6in; margin: 0.15in; }
      }
      body { font-family: Arial, sans-serif; }
      .label { width: 100%; max-width: 4in; border: 2px solid #000; padding: 8px; margin: 0 auto 12px; page-break-after: always; background: #fff; }
      h1 { font-size: 16px; margin: 0 0 6px; font-weight: bold; text-align: center; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; text-align: left; margin: 4px 0; font-size: 7px; border: 1px solid #ddd; padding: 4px; background: #f9f9f9; }
      .info-item { display: flex; flex-direction: column; line-height: 1.2; }
      .info-label { font-weight: bold; font-size: 6px; text-transform: uppercase; color: #666; }
      .info-value { font-size: 7px; color: #000; margin-top: 1px; }
      img { width: 120px; height: 120px; display: block; margin: 6px auto; }
      .id { font-size: 12px; font-weight: bold; font-family: monospace; margin: 4px 0; padding: 4px; background: #f0f0f0; border-radius: 2px; border: 1px solid #000; text-align: center; }
    `;
    const content = labels.map(l => {
      const qr = generateQRDataURL(l.qrValue, 200);
      const grid = l.info.map(f => `<div class="info-item"><span class="info-label">${f.label}</span><span class="info-value">${f.value}</span></div>`).join('');
      return `
        <div class="label">
          <h1>${l.title}</h1>
          <div class="info-grid">${grid}</div>
          <img src="${qr}" alt="QR" />
          <div class="id">${l.qrValue}</div>
        </div>
      `;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Print Labels</title><style>${style}</style></head><body>${content}</body></html>`);
    w.document.close();
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api<Product[]>("/api/wms/inventory");
      setProducts(data);
    } catch (e) {
      toast.error("Failed to load inventory products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const data = await api<ProductionEvent[]>("/api/wms/production/history");
      setEvents(data);
    } catch (e) {
      toast.error("Failed to load production history");
    } finally {
      setLoadingEvents(false);
    }
  };
  useEffect(() => { fetchEvents(); }, []);

  const addRawLine = () => setRawLines(prev => [...prev, { productId: "", quantity: 0 }]);
  const addOutputLine = () => setOutputLines(prev => [...prev, { productId: "", quantity: 0 }]);

  const updateRawLine = (idx: number, patch: Partial<LineItem>) => {
    setRawLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };
  const updateOutputLine = (idx: number, patch: Partial<LineItem>) => {
    setOutputLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const removeRawLine = (idx: number) => setRawLines(prev => prev.filter((_, i) => i !== idx));
  const removeOutputLine = (idx: number) => setOutputLines(prev => prev.filter((_, i) => i !== idx));

  const runProduction = async () => {
    const validRaw = rawLines.filter(l => l.productId && l.quantity > 0);
    const validOutput = outputLines.filter(l => l.productId && l.quantity > 0);
    if (validRaw.length === 0 || validOutput.length === 0) {
      toast.error("Add at least one raw and one output line with quantity");
      return;
    }
    // Client-side guard: ensure raw picks do not exceed available inventory
    const overdraw = validRaw.filter(l => (productsById.get(l.productId)?.quantity ?? 0) < l.quantity);
    if (overdraw.length > 0) {
      const first = overdraw[0];
      const p = productsById.get(first.productId);
      toast.error(`Insufficient inventory for ${p?.name || first.productId}. Available: ${p?.quantity ?? 0}, requested: ${first.quantity}`);
      return;
    }
    try {
      const res = await api<{ updatedProducts: Product[]; eventId: string }>("/api/wms/production", {
        method: "POST",
        body: JSON.stringify({ rawItems: validRaw, outputItems: validOutput }),
      });
      toast.success("Production completed successfully");
      // refresh products to reflect updates
      await fetchProducts();
      await fetchEvents();
      if (res?.eventId) {
        setQrEventId(res.eventId);
        setQrOpen(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Production failed");
    }
  };

  const productOptions = products.map(p => ({ id: p.id, label: `${p.name} (${p.id})` }));

  return (
    <AppLayout container>
      <PageHeader title="Production" subtitle="Consume raw materials to produce finished goods.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchProducts(); fetchEvents(); }} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={runProduction}>
            Run Production
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="run">
        <TabsList>
          <TabsTrigger value="run">Run Production</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="run">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Raw Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawLines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={line.productId || undefined} onValueChange={(v) => {
                        // Do not commit selection yet; open modal to capture batch/expiry
                        setPendingProductId(v);
                        setBatchIndex(idx);
                        setBatchCode(line.batchCode || "");
                        setBatchExpiry(line.expiryDate || "");
                        setSupplier(line.supplier || "");
                        setRawName(line.rawName || "");
                        setBatchOpen(true);
                      }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select raw product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{`${p.name} (${p.id})`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={productsById.get(line.productId || "")?.quantity ?? undefined}
                        value={line.quantity}
                        onChange={(e) => {
                          const max = productsById.get(line.productId || "")?.quantity ?? Number.POSITIVE_INFINITY;
                          const val = Number(e.target.value);
                          const clamped = Math.max(0, Math.min(val, max));
                          setRawLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: clamped } : l));
                        }}
                      />
                      {line.productId && (
                        <div className="text-xs text-muted-foreground mt-1 space-y-1">
                          <div>Available: {productsById.get(line.productId)?.quantity ?? 0}</div>
                          {(line.batchCode || line.expiryDate || line.supplier || line.rawName) && (
                            <div>
                              Batch: {line.batchCode || "-"} · Expiry: {line.expiryDate ? new Date(line.expiryDate).toLocaleDateString() : "-"}
                              <div>Supplier: {line.supplier || "-"} · Raw Name: {line.rawName || "-"}</div>
                              <Button variant="link" className="px-1" onClick={() => { setBatchIndex(idx); setBatchCode(line.batchCode || ""); setBatchExpiry(line.expiryDate || ""); setBatchOpen(true); }}>Edit</Button>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => removeRawLine(idx)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3}>
                    <Button variant="outline" onClick={addRawLine} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Raw Line
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finished Goods</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">Quantity</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputLines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={line.productId || undefined} onValueChange={(v) => updateOutputLine(idx, { productId: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select finished product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productOptions.map(opt => (
                            <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => updateOutputLine(idx, { quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => removeOutputLine(idx)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3}>
                    <Button variant="outline" onClick={addOutputLine} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Output Line
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Production History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead className="text-right">Raw Qty Used</TableHead>
                    <TableHead className="text-right">Output Qty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEvents ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6">Loading…</TableCell></TableRow>
                  ) : events.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6">No production events yet.</TableCell></TableRow>
                  ) : (
                    events.map(evt => (
                      <>
                        <TableRow key={evt.id}>
                          <TableCell className="font-mono">
                            <Button variant="ghost" size="icon" className="mr-2" onClick={() => setExpanded(prev => ({ ...prev, [evt.id]: !prev[evt.id] }))}>
                              {expanded[evt.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            {evt.id}
                            <span className="inline-flex items-center gap-1 ml-2">
                              <Button variant="ghost" size="icon" aria-label="View event" title="View" onClick={() => navigate(`/production-event/${evt.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Show QR" title="QR" onClick={() => { setQrEventId(evt.id); setQrOpen(true); }}>
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </span>
                          </TableCell>
                          <TableCell>{evt.userName}</TableCell>
                          <TableCell>{new Date(evt.timestamp).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{evt.rawItems.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                          <TableCell className="text-right">{evt.outputItems.reduce((s, i) => s + i.quantity, 0)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/production-event/${evt.id}`)}>View</Button>
                              <Button size="sm" onClick={() => { setQrEventId(evt.id); setQrOpen(true); }}>QR</Button>
                              <Button size="sm" variant="secondary" onClick={() => { setLabelsEvent(evt); setLabelsOpen(true); }}>Print Labels</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded[evt.id] && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                <div>
                                  <div className="font-semibold mb-2">Raw Items</div>
                                  <div className="space-y-2">
                                    {evt.rawItems.map((ri, idx) => (
                                      <div key={`${evt.id}-raw-${idx}`} className="text-sm border rounded p-2">
                                        <div>Product: <span className="font-mono">{ri.productId}</span></div>
                                        <div>Quantity: {ri.quantity}</div>
                                        <div>Supplier: {ri.supplier || '-'}</div>
                                        <div>Raw Name: {ri.rawName || '-'}</div>
                                        <div>Batch: {ri.batchCode || '-'}</div>
                                        <div>Expiry: {ri.expiryDate ? new Date(ri.expiryDate).toLocaleDateString() : '-'}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-semibold mb-2">Output Items</div>
                                  <div className="space-y-2">
                                    {evt.outputItems.map((oi, idx) => (
                                      <div key={`${evt.id}-out-${idx}`} className="text-sm border rounded p-2">
                                        <div>Product: <span className="font-mono">{oi.productId}</span></div>
                                        <div>Quantity: {oi.quantity}</div>
                                        {oi.supplier || oi.rawName ? (
                                          <div>Supplier: {oi.supplier || '-'} · Raw Name: {oi.rawName || '-'}</div>
                                        ) : null}
                                        <div>Batch: {oi.batchCode || '-'}</div>
                                        <div>Expiry: {oi.expiryDate ? new Date(oi.expiryDate).toLocaleDateString() : '-'}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={batchOpen} onOpenChange={(open) => {
        if (!open) {
          // Cancel: clear pending selection without committing
          setPendingProductId(null);
        }
        setBatchOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raw Batch Details</DialogTitle>
            <DialogDescription>Enter batch code and expiry date for the selected raw material.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Batch Code</label>
              <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="e.g., LOT-2026-0113-001" />
            </div>
            <div>
              <label className="text-sm">Expiry Date</label>
              <Input type="date" value={batchExpiry} onChange={(e) => setBatchExpiry(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Supplier</label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g., Supplier X" />
            </div>
            <div>
              <label className="text-sm">Raw Name</label>
              <Input value={rawName} onChange={(e) => setRawName(e.target.value)} placeholder="e.g., Organic Flour" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingProductId(null); setBatchOpen(false); }}>Cancel</Button>
            <Button onClick={() => {
              if (batchIndex !== null) {
                const next: Partial<LineItem> = { batchCode: batchCode || undefined, expiryDate: batchExpiry || undefined, supplier: supplier || undefined, rawName: rawName || undefined };
                if (pendingProductId) next.productId = pendingProductId;
                updateRawLine(batchIndex, next);
              }
              setPendingProductId(null);
              setBatchOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Production Run Labels</DialogTitle>
            <DialogDescription>Print one label per output product with location.</DialogDescription>
          </DialogHeader>
          {qrEventId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => {
                  const n = outputLines.filter(l => l.productId && l.quantity > 0).length;
                  setSelectedRunLabels(new Set(Array.from({ length: n }, (_, i) => i)));
                }}>Select All</Button>
                <Button variant="outline" onClick={() => setSelectedRunLabels(new Set())}>Clear</Button>
                <Button onClick={() => {
                  const filtered = outputLines.filter(l => l.productId && l.quantity > 0);
                  const indices = selectedRunLabels.size ? Array.from(selectedRunLabels) : filtered.map((_, i) => i);
                  const labels = indices.map(i => {
                    const l = filtered[i];
                    const prod = productsById.get(l.productId!);
                    return {
                      title: 'PRODUCT LABEL',
                      qrValue: `${window.location.origin}/production-event/${qrEventId}`,
                      info: [
                        { label: 'Product', value: prod?.name || l.productId! },
                        { label: 'SKU', value: l.productId! },
                        { label: 'Qty', value: String(l.quantity) },
                        { label: 'Location', value: prod?.locationId || '-' },
                        { label: 'Event', value: qrEventId! },
                      ],
                    };
                  });
                  printLabelsBatch(labels);
                }}>Print Selected</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outputLines
                  .filter(l => l.productId && l.quantity > 0)
                  .map((l, idx) => {
                    const prod = productsById.get(l.productId!);
                    const name = prod?.name || l.productId;
                    const loc = prod?.locationId || '-';
                    const checked = selectedRunLabels.has(idx);
                    return (
                      <div key={`lbl-${qrEventId}-${idx}`} className="border rounded p-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            setSelectedRunLabels(prev => {
                              const next = new Set(prev);
                              if (v) next.add(idx); else next.delete(idx);
                              return next;
                            });
                          }} />
                          <div className="text-sm">{name} · {l.productId} · Qty {l.quantity} · Loc {loc}</div>
                        </div>
                        <QRCodeDisplay
                          value={`${window.location.origin}/production-event/${qrEventId}`}
                          size={220}
                          showDownload
                          showPrint
                          labelTitle="PRODUCT LABEL"
                          infoFields={[
                            { label: 'Product', value: name },
                            { label: 'SKU', value: l.productId! },
                            { label: 'Qty', value: String(l.quantity) },
                            { label: 'Location', value: loc },
                            { label: 'Event', value: qrEventId! },
                          ]}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div>Generating labels…</div>
          )}
          <DialogFooter>
            <Button onClick={() => setQrOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Print Labels</DialogTitle>
            <DialogDescription>Event-specific labels for each output product.</DialogDescription>
          </DialogHeader>
          {labelsEvent ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => {
                  setSelectedEventLabels(new Set(Array.from({ length: labelsEvent.outputItems.length }, (_, i) => i)));
                }}>Select All</Button>
                <Button variant="outline" onClick={() => setSelectedEventLabels(new Set())}>Clear</Button>
                <Button onClick={() => {
                  const indices = selectedEventLabels.size ? Array.from(selectedEventLabels) : labelsEvent.outputItems.map((_, i) => i);
                  const labels = indices.map(i => {
                    const oi = labelsEvent.outputItems[i];
                    const prod = productsById.get(oi.productId);
                    return {
                      title: 'PRODUCT LABEL',
                      qrValue: `${window.location.origin}/production-event/${labelsEvent.id}`,
                      info: [
                        { label: 'Product', value: prod?.name || oi.productId },
                        { label: 'SKU', value: oi.productId },
                        { label: 'Qty', value: String(oi.quantity) },
                        { label: 'Location', value: oi.locationId || prod?.locationId || '-' },
                        { label: 'Event', value: labelsEvent.id },
                      ],
                    };
                  });
                  printLabelsBatch(labels);
                }}>Print Selected</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labelsEvent.outputItems.map((oi, i) => {
                  const prod = productsById.get(oi.productId);
                  const name = prod?.name || oi.productId;
                  const loc = oi.locationId || prod?.locationId || '-';
                  const checked = selectedEventLabels.has(i);
                  return (
                    <div key={`evt-${labelsEvent.id}-out-${i}`} className="border rounded p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setSelectedEventLabels(prev => {
                            const next = new Set(prev);
                            if (v) next.add(i); else next.delete(i);
                            return next;
                          });
                        }} />
                        <div className="text-sm">{name} · {oi.productId} · Qty {oi.quantity} · Loc {loc}</div>
                      </div>
                      <QRCodeDisplay
                        value={`${window.location.origin}/production-event/${labelsEvent.id}`}
                        size={220}
                        showDownload
                        showPrint
                        labelTitle="PRODUCT LABEL"
                        infoFields={[
                          { label: 'Product', value: name },
                          { label: 'SKU', value: oi.productId },
                          { label: 'Qty', value: String(oi.quantity) },
                          { label: 'Location', value: loc },
                          { label: 'Event', value: labelsEvent.id },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>Loading…</div>
          )}
          <DialogFooter>
            <Button onClick={() => setLabelsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster richColors />
    </AppLayout>
  );
}

export default ProductionPage;