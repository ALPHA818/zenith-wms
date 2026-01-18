import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { ProductionEvent } from "@shared/types";
import { toast } from "sonner";

export function ProductionHistoryPage(): JSX.Element {
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await api<ProductionEvent[]>("/api/wms/production/history");
      setEvents(data);
    } catch (e) {
      toast.error("Failed to load production history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString();
  const totalRawQty = (evt: ProductionEvent) => evt.rawItems.reduce((s, i) => s + i.quantity, 0);
  const totalOutputQty = (evt: ProductionEvent) => evt.outputItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <AppLayout container>
      <PageHeader title="Production History" subtitle="Who, when, and how much raw was used." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead className="text-right">Raw Qty Used</TableHead>
                <TableHead className="text-right">Output Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6">Loading…</TableCell></TableRow>
              ) : events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6">No production events yet.</TableCell></TableRow>
              ) : (
                events.map(evt => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-mono">{evt.id}</TableCell>
                    <TableCell>{evt.userName}</TableCell>
                    <TableCell>{formatDateTime(evt.timestamp)}</TableCell>
                    <TableCell className="text-right">{totalRawQty(evt)}</TableCell>
                    <TableCell className="text-right">{totalOutputQty(evt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

export default ProductionHistoryPage;