import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { VehicleInspectionFormData, vehicleInspectionSchema, Product } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";

interface VehicleInspectionFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (shipmentId: string, inspectionType: 'dispatch' | 'receiving', data: VehicleInspectionFormData) => Promise<void>;
  inspectionType: 'dispatch' | 'receiving';
  shipmentId: string;
  orderId: string;
}

export function VehicleInspectionFormSheet({
  isOpen,
  onClose,
  onSubmit,
  inspectionType,
  shipmentId,
  orderId,
}: VehicleInspectionFormSheetProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const user = useAuthStore((state) => state.user);

  const form = useForm<VehicleInspectionFormData>({
    resolver: zodResolver(vehicleInspectionSchema),
    defaultValues: {
      hasHoles: false,
      isWet: false,
      isClean: true,
      hasDamage: false,
      hasOdor: false,
      temperatureOk: true,
      driverName: "",
      vehicleRegistration: "",
      orderDocumentationNumber: orderId || "",
      items: [],
      notes: "",
    } as VehicleInspectionFormData,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const data = await api<Product[]>('/api/wms/products');
        setProducts(data.filter(p => p.status === 'In Stock' || p.status === 'Low Stock'));
      } catch (error) {
        toast.error("Failed to fetch products.");
        console.error(error);
      } finally {
        setLoadingProducts(false);
      }
    };

    if (isOpen) {
      fetchProducts();
      form.reset({
        hasHoles: false,
        isWet: false,
        isClean: true,
        hasDamage: false,
        hasOdor: false,
        temperatureOk: true,
        driverName: "",
        vehicleRegistration: "",
        orderDocumentationNumber: orderId || "",
        items: [],
        notes: "",
      });
    }
  }, [isOpen, orderId, form]);

  const handleProductSelect = (productId: string, index: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.productName`, product.name);
    }
  };

  const handleAddProduct = () => {
    append({ productId: "", productName: "", quantity: 1 });
  };

  const hasInspectionIssues = () => {
    const values = form.watch();
    return values.hasHoles || values.isWet || !values.isClean || 
           values.hasDamage || values.hasOdor || !values.temperatureOk;
  };

  const handleFormSubmit = async (data: VehicleInspectionFormData) => {
    // Check for issues and warn user
    if (hasInspectionIssues()) {
      const confirmed = window.confirm(
        "⚠️ The vehicle inspection has identified issues. Are you sure you want to proceed?"
      );
      if (!confirmed) return;
    }

    await onSubmit(shipmentId, inspectionType, data);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {inspectionType === 'dispatch' ? 'Dispatch' : 'Receiving'} Inspection - {shipmentId}
          </SheetTitle>
          <SheetDescription>
            Complete the vehicle inspection checklist and record {inspectionType === 'dispatch' ? 'outbound' : 'inbound'} products.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-6">
            {/* Vehicle Interior Condition Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {hasInspectionIssues() ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  Vehicle Interior Condition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hasHoles"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={field.value ? "text-destructive" : ""}>
                            Has Holes
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isWet"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={field.value ? "text-destructive" : ""}>
                            Is Wet
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isClean"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={!field.value ? "text-destructive" : ""}>
                            Is Clean
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hasDamage"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={field.value ? "text-destructive" : ""}>
                            Has Damage
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hasOdor"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={field.value ? "text-destructive" : ""}>
                            Has Odor
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="temperatureOk"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={!field.value ? "text-destructive" : ""}>
                            Temperature OK
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Driver and Vehicle Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Driver & Vehicle Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="driverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleRegistration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Registration</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ABC-1234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderDocumentationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Documentation Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ORD-001" {...field} />
                      </FormControl>
                      <FormDescription>
                        Reference number for the associated order or delivery documentation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Products Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Products</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add products being {inspectionType === 'dispatch' ? 'dispatched' : 'received'}. 
                  Selected quantities will be {inspectionType === 'dispatch' ? 'removed from' : 'added to'} inventory.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start border p-3 rounded-md">
                    <div className="flex-1 space-y-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select
                              onValueChange={(value) => handleProductSelect(value, index)}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loadingProducts ? (
                                  <SelectItem value="loading" disabled>
                                    Loading...
                                  </SelectItem>
                                ) : products.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No products available
                                  </SelectItem>
                                ) : (
                                  products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name} ({product.id}) - Available: {product.quantity}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                placeholder="Enter quantity"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="mt-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddProduct}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional observations or notes..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="sticky bottom-0 bg-background pt-4 border-t">
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Complete Inspection
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
