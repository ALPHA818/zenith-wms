import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pallet, JobCard } from "@shared/types";
import { Package, MapPin, Calendar, Plus, Minus, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface PalletScanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pallet: Pallet | null;
  onUpdatePallet: () => void;
}

interface PickItem {
  productId: string;
  productName: string;
  quantityToPick: number;
  availableQuantity: number;
}

export function PalletScanDialog({ isOpen, onClose, pallet, onUpdatePallet }: PalletScanDialogProps) {
  const [pickItems, setPickItems] = useState<PickItem[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [selectedJobCard, setSelectedJobCard] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pallet) {
      // Initialize pick items from pallet products
      setPickItems(
        pallet.products.map(p => ({
          productId: p.id,
          productName: p.name,
          quantityToPick: 0,
          availableQuantity: p.quantity,
        }))
      );
      
      // Fetch in-progress job cards
      fetchInProgressJobCards();
    }
  }, [isOpen, pallet]);

  const fetchInProgressJobCards = async () => {
    try {
      const cards = await api<JobCard[]>('/api/wms/jobcards');
      const inProgress = cards.filter(c => c.status === 'In Progress');
      setJobCards(inProgress);
    } catch (error) {
      console.error("Failed to fetch job cards:", error);
      toast.error("Failed to load job cards");
    }
  };

  const handleQuantityChange = (productId: string, change: number) => {
    setPickItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.max(0, Math.min(item.availableQuantity, item.quantityToPick + change));
          return { ...item, quantityToPick: newQuantity };
        }
        return item;
      })
    );
  };

  const handleSetQuantity = (productId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setPickItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.max(0, Math.min(item.availableQuantity, quantity));
          return { ...item, quantityToPick: newQuantity };
        }
        return item;
      })
    );
  };

  const handleAddToJobCard = async () => {
    if (!selectedJobCard) {
      toast.error("Please select a job card");
      return;
    }

    const itemsToPick = pickItems.filter(item => item.quantityToPick > 0);
    if (itemsToPick.length === 0) {
      toast.error("Please select quantities to pick");
      return;
    }

    setLoading(true);
    try {
      // Update pallet quantities
      if (pallet) {
        const updatedProducts = pallet.products.map(p => {
          const pickItem = itemsToPick.find(i => i.productId === p.id);
          if (pickItem) {
            return {
              ...p,
              quantity: p.quantity - pickItem.quantityToPick,
            };
          }
          return p;
        }).filter(p => p.quantity > 0); // Remove products with 0 quantity

        await api(`/api/wms/pallets/${pallet.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...pallet,
            products: updatedProducts,
            totalQuantity: updatedProducts.reduce((sum, p) => sum + p.quantity, 0),
          }),
        });

        // Add note to job card about picked items
        const jobCard = jobCards.find(jc => jc.id === selectedJobCard);
        if (jobCard) {
          const pickNote = itemsToPick
            .map(item => `Picked ${item.quantityToPick}x ${item.productName} from ${pallet.id}`)
            .join(', ');
          
          const updatedDescription = jobCard.description 
            ? `${jobCard.description}\n\n${pickNote}`
            : pickNote;

          await api(`/api/wms/jobcards/${selectedJobCard}`, {
            method: 'PUT',
            body: JSON.stringify({
              ...jobCard,
              description: updatedDescription,
            }),
          });
        }

        toast.success(`Picked items added to job card ${selectedJobCard}`);
        onUpdatePallet();
        onClose();
      }
    } catch (error) {
      console.error("Failed to pick items:", error);
      toast.error("Failed to pick items from pallet");
    } finally {
      setLoading(false);
    }
  };

  if (!pallet) return null;

  const totalToPick = pickItems.reduce((sum, item) => sum + item.quantityToPick, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pallet: {pallet.id}
          </DialogTitle>
          <DialogDescription>
            Scan successful - Select quantities to pick and assign to job card
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pallet Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{pallet.type}</Badge>
              <span className="text-sm text-muted-foreground">Type</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{pallet.locationId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{pallet.totalQuantity} total units</span>
            </div>
            {pallet.expiryDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{new Date(pallet.expiryDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Product Selection */}
          <div>
            <h3 className="font-semibold mb-3">Select Products to Pick</h3>
            <div className="space-y-3">
              {pickItems.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.productId}</p>
                    <p className="text-sm text-muted-foreground">Available: {item.availableQuantity}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleQuantityChange(item.productId, -1)}
                      disabled={item.quantityToPick === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    
                    <Input
                      type="number"
                      min="0"
                      max={item.availableQuantity}
                      value={item.quantityToPick}
                      onChange={(e) => handleSetQuantity(item.productId, e.target.value)}
                      className="w-20 text-center"
                    />
                    
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleQuantityChange(item.productId, 1)}
                      disabled={item.quantityToPick >= item.availableQuantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalToPick > 0 && (
            <>
              <Separator />
              
              {/* Job Card Selection */}
              <div>
                <Label htmlFor="jobcard-select" className="mb-2 block">
                  Assign to Job Card
                </Label>
                <Select value={selectedJobCard} onValueChange={setSelectedJobCard}>
                  <SelectTrigger id="jobcard-select">
                    <SelectValue placeholder="Select an in-progress job card" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobCards.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No job cards in progress
                      </SelectItem>
                    ) : (
                      jobCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.id} - {card.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Total to pick: <span className="text-lg font-bold">{totalToPick}</span> units
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {totalToPick > 0 && (
            <Button onClick={handleAddToJobCard} disabled={loading || !selectedJobCard}>
              {loading ? "Processing..." : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Pick
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
