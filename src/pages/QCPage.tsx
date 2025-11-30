import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, Package, TruckIcon, Plus, ClipboardCheck, Eye } from "lucide-react";
import { VehicleInspectionFormSheet } from "@/components/wms/VehicleInspectionFormSheet";
import { Shipment, VehicleInspectionFormData, VehicleInspection } from "@shared/types";
import { api } from "@/lib/api-client";
import { toast, Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function QCPage() {
  const [activeTab, setActiveTab] = useState<"receiving" | "dispatch" | "completed">("receiving");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<{ type: 'dispatch' | 'receiving', data: VehicleInspection, shipment: Shipment } | null>(null);
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

  return (
    <AppLayout container>
      <PageHeader 
        title="Quality Control" 
        subtitle="Manage quality checks for receiving and dispatch operations"
      />

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

      <Toaster richColors />
    </AppLayout>
  );
}
