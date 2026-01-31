import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PackageOpen, MapPin, Calendar, Box, Plus, MoreVertical, Edit, Trash, Clock, List, Search, QrCode } from "lucide-react";
import { api } from "@/lib/api-client";
import { Pallet } from "@shared/types";
import { Toaster, toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PalletFormSheet } from "@/components/wms/PalletFormSheet";
import { PalletListDialog } from "@/components/wms/PalletListDialog";
import { QRCodeDisplay } from "@/components/wms/QRCodeDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PalletRawPage() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [palletToDelete, setPalletToDelete] = useState<Pallet | null>(null);
  const [palletListOpen, setPalletListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedPalletForQR, setSelectedPalletForQR] = useState<Pallet | null>(null);

  const fetchPallets = async () => {
    try {
      setLoading(true);
      const data = await api<Pallet[]>('/api/wms/pallets');
      // Filter for Raw type pallets only
      const rawPallets = data.filter(p => p.type === 'Raw');
      setPallets(rawPallets);
    } catch (error) {
      toast.error("Failed to load raw material pallet data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPallets();
  }, []);

  const handleCreatePallet = () => {
    setSelectedPallet(null);
    setFormOpen(true);
  };

  const handleEditPallet = (pallet: Pallet) => {
    setSelectedPallet(pallet);
    setFormOpen(true);
  };

  const handleEmptyPallet = (pallet: Pallet) => {
    setPalletToDelete(pallet);
    setDeleteDialogOpen(true);
  };

  const handleShowQRCode = (pallet: Pallet) => {
    setSelectedPalletForQR(pallet);
    setQrDialogOpen(true);
  };

  const handleSubmitPallet = async (palletData: Partial<Pallet>) => {
    try {
      if (selectedPallet) {
        // Update existing pallet
        await api(`/api/wms/pallets/${selectedPallet.id}`, {
          method: 'PUT',
          body: JSON.stringify(palletData),
        });
        toast.success("Pallet updated successfully!");
      } else {
        // Create new pallet
        await api('/api/wms/pallets', {
          method: 'POST',
          body: JSON.stringify(palletData),
        });
        toast.success("Pallet created successfully!");
      }
      fetchPallets();
    } catch (error) {
      toast.error("Failed to save pallet.");
      throw error;
    }
  };

  const confirmEmptyPallet = async () => {
    if (!palletToDelete) return;
    
    try {
      // Empty the pallet by updating it with empty products array
      await api(`/api/wms/pallets/${palletToDelete.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          locationId: palletToDelete.locationId,
          expiryDate: palletToDelete.expiryDate,
          monthsUntilExpiry: palletToDelete.monthsUntilExpiry,
          products: [],
          totalQuantity: 0,
        }),
      });
      toast.success("Pallet emptied successfully!");
      fetchPallets();
    } catch (error) {
      toast.error("Failed to empty pallet.");
    } finally {
      setDeleteDialogOpen(false);
      setPalletToDelete(null);
    }
  };

  const getStatusColor = (status: Pallet['status']) => {
    switch (status) {
      case 'Ready':
        return 'bg-green-500';
      case 'In Transit':
        return 'bg-blue-500';
      case 'Delivered':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter pallets based on search query
  const filteredPallets = pallets.filter((pallet) => {
    const query = searchQuery.toLowerCase();
    const palletNumber = pallet.id.split('-').pop() || '';
    return (
      pallet.id.toLowerCase().includes(query) ||
      palletNumber.includes(query) ||
      pallet.locationId.toLowerCase().includes(query) ||
      pallet.products.some(p => 
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.batchCode?.toLowerCase().includes(query)
      )
    );
  });

  return (
    <AppLayout container>
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <PageHeader 
            title="PalletRaw" 
            subtitle="Manage raw material pallets in receiving and storage." 
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPalletListOpen(true)}>
              <List className="h-4 w-4 mr-2" />
              View All Pallets
            </Button>
            <Button onClick={handleCreatePallet}>
              <Plus className="h-4 w-4 mr-2" />
              New Pallet
            </Button>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by pallet ID, location, material name, or lot code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPallets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            {searchQuery ? `No pallets found matching "${searchQuery}"` : "No raw material pallets found. Add raw materials to create pallets."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredPallets.map((pallet) => {
            // Extract number from pallet ID (e.g., PLT-000019 -> 000019)
            const palletNumber = pallet.id.split('-').pop() || '000000';
            return (
            <Card key={pallet.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <PackageOpen className="h-6 w-6 text-orange-500" />
                    <div>
                      <CardTitle className="text-xl">#{palletNumber}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{pallet.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pallet.monthsUntilExpiry !== undefined && pallet.monthsUntilExpiry !== null && (
                      <>
                        <Badge variant={pallet.monthsUntilExpiry <= 6 ? "destructive" : pallet.monthsUntilExpiry === 7 ? "secondary" : "default"} className={pallet.monthsUntilExpiry > 8 ? "bg-green-600 hover:bg-green-700" : ""}>
                          <Clock className="h-3 w-3 mr-1" />
                          {pallet.monthsUntilExpiry}mo
                        </Badge>
                        {pallet.monthsUntilExpiry === 7 && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Badge variant="outline" className="border-orange-500 text-orange-700 cursor-help">
                                    Notify QC/QA
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-sm">This raw material pallet is approaching expiration (7 months remaining). Quality Control/Quality Assurance should be notified to prioritize usage or conduct additional quality checks before expiration.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1"
                      onClick={() => handleShowQRCode(pallet)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPallet(pallet)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Pallet
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleEmptyPallet(pallet)}
                          className="text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Empty Pallet
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2 mt-3">
                  <MapPin className="h-4 w-4" />
                  {pallet.locationId}
                </CardDescription>
                {pallet.expiryDate && (
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    Expires: {formatDate(pallet.expiryDate)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(pallet.createdDate)}
                  </div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Box className="h-4 w-4" />
                    {pallet.totalQuantity.toLocaleString()} units
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <PackageOpen className="h-4 w-4" />
                      Raw Materials on Pallet
                    </span>
                    <Badge variant="secondary">{pallet.products.length} items</Badge>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pallet.products.map((product) => (
                      <div 
                        key={product.id} 
                        className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium flex-1">{product.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {product.quantity}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{product.id}</span>
                          <span>•</span>
                          <span>{product.category}</span>
                        </div>

                        {product.batchCode && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Box className="h-3 w-3" />
                            Lot: {product.batchCode}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
      
      <PalletFormSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitPallet}
        pallet={selectedPallet}
        palletType="Raw"
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty this pallet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all items from pallet {palletToDelete?.id}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEmptyPallet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Empty Pallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PalletListDialog isOpen={palletListOpen} onClose={() => setPalletListOpen(false)} />
      
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pallet QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to quickly access pallet {selectedPalletForQR?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {selectedPalletForQR && (
              <QRCodeDisplay value={selectedPalletForQR.id} size={250} showDownload={true} showPrint={true} palletData={selectedPalletForQR} />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Toaster richColors />
    </AppLayout>
  );
}
