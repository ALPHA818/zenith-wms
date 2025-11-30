import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2, ClipboardCheck, PackageCheck, Eye } from "lucide-react";
import { Shipment, ShipmentStatus, ShipmentFormData, VehicleInspection } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ShipmentFormSheet } from "@/components/wms/ShipmentFormSheet";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
export function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<{ type: 'dispatch' | 'receiving', data: VehicleInspection } | null>(null);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:shipments') ?? false;
  const isMobile = useIsMobile();
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
  const handleAddShipment = () => { setSelectedShipment(null); setIsSheetOpen(true); };
  const handleEditShipment = (shipment: Shipment) => { setSelectedShipment(shipment); setIsSheetOpen(true); };
  const handleDeleteClick = (shipment: Shipment) => { setShipmentToDelete(shipment); setIsDeleteDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!shipmentToDelete) return;
    try {
      await api(`/api/wms/shipments/${shipmentToDelete.id}`, { method: 'DELETE' });
      toast.success(`Shipment "${shipmentToDelete.id}" deleted successfully.`);
      fetchShipments();
    } catch (error) {
      toast.error("Failed to delete shipment.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setShipmentToDelete(null);
    }
  };
  const handleFormSubmit = async (data: ShipmentFormData) => {
    try {
      const method = selectedShipment ? 'PUT' : 'POST';
      const url = selectedShipment ? `/api/wms/shipments/${selectedShipment.id}` : '/api/wms/shipments';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`Shipment "${data.id}" ${selectedShipment ? 'updated' : 'created'} successfully.`);
      setIsSheetOpen(false);
      fetchShipments();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save shipment: ${errorMessage}`);
      console.error(error);
    }
  };
  const getStatusVariant = (status: ShipmentStatus) => {
    switch (status) {
      case 'Preparing': return 'secondary';
      case 'In Transit': return 'default';
      case 'Delivered': return 'outline';
      case 'Delayed': return 'destructive';
      default: return 'outline';
    }
  };

  const handleViewInspection = (type: 'dispatch' | 'receiving', data: VehicleInspection) => {
    setSelectedInspection({ type, data });
    setInspectionDialogOpen(true);
  };

  const renderActions = (shipment: Shipment) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditShipment(shipment)}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteClick(shipment)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <AppLayout container>
      <PageHeader title="Shipment Tracking" subtitle="Monitor all inbound and outbound shipments.">
        {canManage && (
          <Button onClick={handleAddShipment} className="hover:shadow-md transition-shadow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Shipment
          </Button>
        )}
      </PageHeader>
      {loading ? (
        isMobile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow>{Array.from({ length: canManage ? 7 : 6 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}</TableRow></TableHeader>
              <TableBody>{Array.from({ length: 4 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: canManage ? 7 : 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>))}</TableBody>
            </Table>
          </div>
        )
      ) : shipments.length === 0 ? (
        <div className="text-center py-12">No shipments found.</div>
      ) : isMobile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shipments.map(shipment => (
            <Card key={shipment.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {shipment.trackingNumber}
                    <div className="flex gap-1">
                      {shipment.dispatchInspection && (
                        <Badge variant="outline" className="text-xs">
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          Dispatch
                        </Badge>
                      )}
                      {shipment.receivingInspection && (
                        <Badge variant="outline" className="text-xs">
                          <PackageCheck className="h-3 w-3 mr-1" />
                          Receiving
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Order: {shipment.orderId}</p>
                </div>
                {canManage && renderActions(shipment)}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Status:</span> <Badge variant={getStatusVariant(shipment.status)}>{shipment.status}</Badge></div>
                <div className="flex justify-between"><span>Carrier:</span> <strong>{shipment.carrier}</strong></div>
                <div className="flex justify-between"><span>Est. Delivery:</span> <span>{new Date(shipment.estimatedDelivery).toLocaleDateString()}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking #</TableHead><TableHead>Order ID</TableHead><TableHead>Carrier</TableHead><TableHead>Status</TableHead><TableHead>Inspections</TableHead><TableHead>Est. Delivery</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-medium">{shipment.trackingNumber}</TableCell><TableCell>{shipment.orderId}</TableCell><TableCell>{shipment.carrier}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(shipment.status)}>{shipment.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {shipment.dispatchInspection && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleViewInspection('dispatch', shipment.dispatchInspection!)}
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          Dispatch
                        </Button>
                      )}
                      {shipment.receivingInspection && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleViewInspection('receiving', shipment.receivingInspection!)}
                        >
                          <PackageCheck className="h-3 w-3 mr-1" />
                          Receiving
                        </Button>
                      )}
                      {!shipment.dispatchInspection && !shipment.receivingInspection && (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(shipment.estimatedDelivery).toLocaleDateString()}</TableCell>
                  {canManage && <TableCell className="text-right">{renderActions(shipment)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage && (
        <ShipmentFormSheet 
          isOpen={isSheetOpen} 
          onClose={() => setIsSheetOpen(false)} 
          onSubmit={handleFormSubmit} 
          shipment={selectedShipment}
          onRefresh={fetchShipments}
        />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete shipment "{shipmentToDelete?.id}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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