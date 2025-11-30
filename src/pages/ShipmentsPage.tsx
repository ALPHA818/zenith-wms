import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2, ClipboardCheck, PackageCheck } from "lucide-react";
import { Shipment, ShipmentStatus, ShipmentFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ShipmentFormSheet } from "@/components/wms/ShipmentFormSheet";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
export function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
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
                        <Badge variant="outline" className="text-xs">
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          D
                        </Badge>
                      )}
                      {shipment.receivingInspection && (
                        <Badge variant="outline" className="text-xs">
                          <PackageCheck className="h-3 w-3 mr-1" />
                          R
                        </Badge>
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
      <Toaster richColors />
    </AppLayout>
  );
}