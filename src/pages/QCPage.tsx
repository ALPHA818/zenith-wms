import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, TruckIcon, Plus, ClipboardCheck } from "lucide-react";
import { VehicleInspectionFormSheet } from "@/components/wms/VehicleInspectionFormSheet";
import { Shipment, VehicleInspectionFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { toast, Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function QCPage() {
  const [activeTab, setActiveTab] = useState<"receiving" | "dispatch">("receiving");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const user = useAuthStore((state) => state.user);

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
      // Show shipments that are in transit or delivered but haven't had receiving inspection
      return shipments.filter(s => 
        (s.status === 'In Transit' || s.status === 'Delivered') && !s.receivingInspection
      );
    } else {
      // Show shipments that are preparing or in transit but haven't had dispatch inspection
      return shipments.filter(s => 
        (s.status === 'Preparing' || s.status === 'In Transit') && !s.dispatchInspection
      );
    }
  };

  const relevantShipments = getRelevantShipments();

  return (
    <AppLayout container>
      <PageHeader 
        title="Quality Control" 
        subtitle="Manage quality checks for receiving and dispatch operations"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "receiving" | "dispatch")} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="receiving" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Receiving
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4" />
            Dispatch
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
                          <Button
                            size="sm"
                            onClick={() => handleInspection(shipment)}
                            className="gap-2"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                            Inspect
                          </Button>
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
                          <Button
                            size="sm"
                            onClick={() => handleInspection(shipment)}
                            className="gap-2"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedShipment && (
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

      <Toaster richColors />
    </AppLayout>
  );
}
