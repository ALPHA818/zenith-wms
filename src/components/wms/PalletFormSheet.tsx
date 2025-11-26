import React, { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pallet, PalletType, PalletStatus, Location } from "@shared/types";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, Trash2, Plus } from "lucide-react";

interface PalletFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pallet: Partial<Pallet>) => Promise<void>;
  pallet: Pallet | null;
  palletType: PalletType;
}

interface ProductItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  batchCode?: string;
  allergens?: string;
  expiryDate?: string;
}

export function PalletFormSheet({ isOpen, onClose, onSubmit, pallet, palletType }: PalletFormSheetProps) {
  const isEditing = !!pallet;
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [locationId, setLocationId] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [monthsUntilExpiry, setMonthsUntilExpiry] = useState<number>(0);
  const [products, setProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const data = await api<Location[]>('/api/wms/locations');
        setLocations(data);
      } catch (error) {
        toast.error("Failed to fetch locations.");
      }
    }

    if (isOpen) {
      fetchLocations();
      
      if (pallet) {
        setLocationId(pallet.locationId);
        setExpiryDate(pallet.expiryDate ? new Date(pallet.expiryDate).toISOString().split('T')[0] : "");
        setMonthsUntilExpiry(pallet.monthsUntilExpiry || 0);
        setProducts(pallet.products.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          batchCode: p.batchCode,
          allergens: p.allergens,
          expiryDate: p.expiryDate,
        })));
      } else {
        setLocationId("");
        setExpiryDate("");
        setMonthsUntilExpiry(0);
        setProducts([]);
      }
    }
  }, [pallet, isOpen]);

  const handleAddProduct = () => {
    const newProduct: ProductItem = {
      id: palletType === 'Product' ? `PROD-${String(Date.now()).slice(-5)}` : `RAW-${String(Date.now()).slice(-5)}`,
      name: "",
      category: palletType === 'Product' ? "Produce" : "Raw Material",
      quantity: 0,
      batchCode: "",
      allergens: palletType === 'Product' ? "" : "N/A",
      expiryDate: palletType === 'Product' ? new Date().toISOString().split('T')[0] : undefined,
    };
    setProducts([...products, newProduct]);
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: keyof ProductItem, value: string | number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleSubmit = async () => {
    if (!locationId) {
      toast.error("Please select a location.");
      return;
    }

    if (products.length === 0) {
      toast.error("Please add at least one item to the pallet.");
      return;
    }

    // Validate products
    for (const product of products) {
      if (!product.name || !product.category || product.quantity <= 0) {
        toast.error("All items must have a name, category, and positive quantity.");
        return;
      }
    }

    const totalQuantity = products.reduce((sum, p) => sum + Number(p.quantity), 0);

    const palletData: Partial<Pallet> = {
      ...(pallet ? { id: pallet.id } : {}),
      type: palletType,
      locationId,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      monthsUntilExpiry: Number(monthsUntilExpiry) || 0,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        quantity: Number(p.quantity),
        status: p.quantity === 0 ? 'Out of Stock' : p.quantity < 50 ? 'Low Stock' : 'In Stock',
        batchCode: p.batchCode,
        allergens: p.allergens,
        expiryDate: p.expiryDate,
      })),
      createdDate: pallet?.createdDate || new Date().toISOString(),
      totalQuantity,
    };

    setLoading(true);
    try {
      await onSubmit(palletData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Edit Pallet" : "Create New Pallet"} - {palletType === 'Product' ? 'Finished Products' : 'Raw Materials'}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? "Update pallet details and items." : "Create a new pallet with items."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Location */}
          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date (Optional)</Label>
            <Input 
              type="date" 
              value={expiryDate} 
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* Months Until Expiry */}
          <div className="space-y-2">
            <Label>Months Until Expiry</Label>
            <Input 
              type="number" 
              value={monthsUntilExpiry} 
              onChange={(e) => setMonthsUntilExpiry(parseInt(e.target.value) || 0)}
              placeholder="0"
              min="0"
            />
          </div>

          {/* Products */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Items on Pallet</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                No items added yet. Click "Add Item" to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item #{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={product.name}
                          onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                          placeholder="Item name"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <Input
                          value={product.category}
                          onChange={(e) => handleProductChange(index, 'category', e.target.value)}
                          placeholder="Category"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={product.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">{palletType === 'Product' ? 'Batch Code' : 'Lot Number'}</Label>
                        <Input
                          value={product.batchCode || ""}
                          onChange={(e) => handleProductChange(index, 'batchCode', e.target.value)}
                          placeholder={palletType === 'Product' ? "BATCH-2025-1127-001" : "LOT-2025-1127-001"}
                        />
                      </div>

                      {palletType === 'Product' && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Allergens</Label>
                            <Input
                              value={product.allergens || ""}
                              onChange={(e) => handleProductChange(index, 'allergens', e.target.value)}
                              placeholder="None"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Expiry Date</Label>
                            <Input
                              type="date"
                              value={product.expiryDate || ""}
                              onChange={(e) => handleProductChange(index, 'expiryDate', e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" disabled={loading}>Cancel</Button>
          </SheetClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Pallet" : "Create Pallet"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
