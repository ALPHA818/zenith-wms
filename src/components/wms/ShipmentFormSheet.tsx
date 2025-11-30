import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shipment, shipmentSchema, ShipmentFormData, VehicleInspectionFormData } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardCheck, PackageCheck } from "lucide-react";
import { VehicleInspectionFormSheet } from "./VehicleInspectionFormSheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";

interface ShipmentFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShipmentFormData) => Promise<void>;
  shipment: Shipment | null;
  onRefresh?: () => void;
}
export function ShipmentFormSheet({ isOpen, onClose, onSubmit, shipment, onRefresh }: ShipmentFormSheetProps) {
  const isEditing = !!shipment;
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [inspectionType, setInspectionType] = useState<'dispatch' | 'receiving'>('dispatch');
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(shipment);
  const user = useAuthStore((state) => state.user);
  
  const form = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      id: "",
      trackingNumber: "",
      carrier: "",
      orderId: "",
      status: "Preparing",
      estimatedDelivery: new Date().toISOString().split('T')[0],
      origin: "",
      destination: "",
    },
  });

  useEffect(() => {
    setCurrentShipment(shipment);
  }, [shipment]);

  useEffect(() => {
    if (isOpen) {
      if (currentShipment) {
        form.reset({
          ...currentShipment,
          estimatedDelivery: new Date(currentShipment.estimatedDelivery).toISOString().split('T')[0],
        });
      } else {
        form.reset({
          id: `SHP-${Date.now().toString().slice(-4)}`,
          trackingNumber: "",
          carrier: "",
          orderId: "",
          status: "Preparing",
          estimatedDelivery: new Date().toISOString().split('T')[0],
          origin: "Warehouse A",
          destination: "",
        });
      }
    }
  }, [currentShipment, form, isOpen]);

  const handleOpenDispatchInspection = () => {
    setInspectionType('dispatch');
    setIsInspectionOpen(true);
  };

  const handleOpenReceivingInspection = () => {
    setInspectionType('receiving');
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

      const updatedShipment = await api<Shipment>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
      });

      toast.success(`${type === 'dispatch' ? 'Dispatch' : 'Receiving'} inspection completed successfully.`);
      
      // Update the current shipment state
      setCurrentShipment(updatedShipment);
      
      setIsInspectionOpen(false);
      
      // Refresh parent if callback provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to save inspection.";
      toast.error(errorMessage);
      console.error(error);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit Shipment" : "Create New Shipment"}</SheetTitle>
            <SheetDescription>
              {isEditing ? "Update the details of the existing shipment." : "Fill in the details for the new shipment."}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6 overflow-y-auto max-h-[calc(100vh-12rem)] pr-4">
              <FormField control={form.control} name="id" render={({ field }) => (
                  <FormItem><FormLabel>Shipment ID</FormLabel><FormControl><Input placeholder="e.g., SHP-103" {...field} disabled={isEditing} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="trackingNumber" render={({ field }) => (
                  <FormItem><FormLabel>Tracking Number</FormLabel><FormControl><Input placeholder="e.g., 1Z999AA10123456784" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="carrier" render={({ field }) => (
                  <FormItem><FormLabel>Carrier</FormLabel><FormControl><Input placeholder="e.g., UPS" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="orderId" render={({ field }) => (
                  <FormItem><FormLabel>Order ID</FormLabel><FormControl><Input placeholder="e.g., ORD-001" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Preparing">Preparing</SelectItem>
                        <SelectItem value="In Transit">In Transit</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Delayed">Delayed</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
              )}/>
              <FormField control={form.control} name="estimatedDelivery" render={({ field }) => (
                  <FormItem><FormLabel>Estimated Delivery</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="origin" render={({ field }) => (
                  <FormItem><FormLabel>Origin</FormLabel><FormControl><Input placeholder="e.g., Warehouse A" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="destination" render={({ field }) => (
                  <FormItem><FormLabel>Destination</FormLabel><FormControl><Input placeholder="e.g., Customer Address" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>

              {isEditing && currentShipment && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Vehicle Inspections</h3>
                    
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleOpenDispatchInspection}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        {currentShipment.dispatchInspection ? 'View/Edit' : 'Add'} Dispatch Inspection
                        {currentShipment.dispatchInspection && (
                          <Badge variant="secondary" className="ml-auto">Completed</Badge>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleOpenReceivingInspection}
                      >
                        <PackageCheck className="mr-2 h-4 w-4" />
                        {currentShipment.receivingInspection ? 'View/Edit' : 'Add'} Receiving Inspection
                        {currentShipment.receivingInspection && (
                          <Badge variant="secondary" className="ml-auto">Completed</Badge>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <SheetFooter className="pt-4 sticky bottom-0 bg-background">
                <SheetClose asChild><Button type="button" variant="outline">Cancel</Button></SheetClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Shipment"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {isEditing && currentShipment && (
        <VehicleInspectionFormSheet
          isOpen={isInspectionOpen}
          onClose={() => setIsInspectionOpen(false)}
          onSubmit={handleInspectionSubmit}
          inspectionType={inspectionType}
          shipmentId={currentShipment.id}
          orderId={currentShipment.orderId}
        />
      )}
    </>
  );
}