import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { ProductionEvent } from "@shared/types";
import { QRCodeDisplay } from "@/components/wms/QRCodeDisplay";

export default function ProductionEventPage(): JSX.Element {
  const { id } = useParams();
  const [evt, setEvt] = useState<ProductionEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!id) return;
        const data = await api<ProductionEvent>(`/api/wms/production/events/${id}`);
        setEvt(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const value = `${window.location.origin}/production-event/${id}`;

  return (
    <AppLayout container>
      <PageHeader title={`Production Event`} subtitle={id ? `Event ${id}` : ""} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="mb-4 space-y-1">
              <div><strong>User:</strong> {evt?.userName || '-'}</div>
              <div><strong>Time:</strong> {evt?.timestamp ? new Date(evt.timestamp).toLocaleString() : '-'}</div>
              {loading && <div className="text-xs text-muted-foreground">Loading event…</div>}
              {!loading && !evt && <div className="text-xs text-destructive">Event not found.</div>}
            </div>
            <QRCodeDisplay value={value} size={180} showDownload showPrint />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {evt ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">Raw Items</TableCell>
                    <TableCell>
                      <div className="grid md:grid-cols-2 gap-3">
                        {evt.rawItems.map((ri, i) => (
                          <div key={`raw-${i}`} className="border rounded p-2 text-sm">
                            <div>Product: <span className="font-mono">{ri.productId}</span></div>
                            <div>Qty: {ri.quantity}</div>
                            <div>Supplier: {ri.supplier || '-'}</div>
                            <div>Raw Name: {ri.rawName || '-'}</div>
                            <div>Batch: {ri.batchCode || '-'}</div>
                            <div>Expiry: {ri.expiryDate ? new Date(ri.expiryDate).toLocaleDateString() : '-'}</div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Output Items</TableCell>
                    <TableCell>
                      <div className="grid md:grid-cols-2 gap-3">
                        {evt.outputItems.map((oi, i) => (
                          <div key={`out-${i}`} className="border rounded p-2 text-sm">
                            <div>Product: <span className="font-mono">{oi.productId}</span></div>
                            <div>Qty: {oi.quantity}</div>
                            <div>Batch: {oi.batchCode || '-'}</div>
                            <div>Expiry: {oi.expiryDate ? new Date(oi.expiryDate).toLocaleDateString() : '-'}</div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No details to show.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}