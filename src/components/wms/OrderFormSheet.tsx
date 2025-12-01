import React, { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Order, orderSchema, OrderFormData, Product } from "@shared/types";
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
import { Loader2, Trash2 } from "lucide-react";
interface OrderFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderFormData) => Promise<void>;
  order: Order | null;
  products: Product[];
}
export function OrderFormSheet({ isOpen, onClose, onSubmit, order, products }: OrderFormSheetProps) {
  const isEditing = !!order;
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      id: "",
      type: "Sales",
      customerName: "",
      carrier: "",
      items: [{ productId: "", productName: "", quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  useEffect(() => {
    if (isOpen) {
      if (order) {
        form.reset({
          ...order,
          items: order.items.length > 0 ? order.items : [{ productId: "", productName: "", quantity: 1 }],
        });
      } else {
        form.reset({
          id: `ORD-${Date.now().toString().slice(-4)}`,
          type: "Sales",
          customerName: "",
          carrier: "",
          items: [{ productId: "", productName: "", quantity: 1 }],
        });
      }
    }
  }, [order, form, isOpen]);
  const handleProductChange = (value: string, index: number) => {
    const product = products.find(p => p.id === value);
    if (product) {
      form.setValue(`items.${index}.productId`, product.id);
      form.setValue(`items.${index}.productName`, product.name);
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Order" : "Create New Order"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update the details of the existing order." : "Fill in the details for the new order."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-15rem)] pr-4">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ORD-004" {...field} disabled={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select an order type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Purchase">Purchase</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer / Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Corporation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DHL, FedEx, UPS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <FormLabel>Order Items</FormLabel>
                <div className="space-y-4 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-3 border rounded-md">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field: itemField }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Product</FormLabel>
                            <Select onValueChange={(value) => handleProductChange(value, index)} defaultValue={itemField.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: itemField }) => (
                          <FormItem className="w-24">
                            <FormLabel className="text-xs">Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Qty" {...itemField} onChange={e => itemField.onChange(parseInt(e.target.value, 10) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ productId: "", productName: "", quantity: 1 })}>
                  Add Item
                </Button>
                <FormField control={form.control} name="items" render={() => <FormMessage />} />
              </div>
            </div>
            <SheetFooter className="pt-4 sticky bottom-0 bg-background">
              <SheetClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </SheetClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Order"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}