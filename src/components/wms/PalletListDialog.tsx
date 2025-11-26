import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Package, PackageOpen, MapPin, Calendar } from "lucide-react";
import { api } from "@/lib/api-client";
import { Pallet } from "@shared/types";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PalletListDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PalletListDialog({ isOpen, onClose }: PalletListDialogProps) {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchPallets();
    }
  }, [isOpen]);

  const fetchPallets = async () => {
    try {
      setLoading(true);
      const data = await api<Pallet[]>('/api/wms/pallets');
      setPallets(data);
    } catch (error) {
      toast.error("Failed to load pallet list.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getExpiryBadge = (monthsUntilExpiry: number | undefined) => {
    if (monthsUntilExpiry === undefined || monthsUntilExpiry === null) return null;
    
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant={monthsUntilExpiry <= 6 ? "destructive" : monthsUntilExpiry === 7 ? "secondary" : "default"} 
          className={monthsUntilExpiry > 8 ? "bg-green-600 hover:bg-green-700" : ""}
        >
          <Clock className="h-3 w-3 mr-1" />
          {monthsUntilExpiry}mo
        </Badge>
        {monthsUntilExpiry === 7 && (
          <Badge variant="outline" className="border-orange-500 text-orange-700 text-xs">
            Notify QC/QA
          </Badge>
        )}
      </div>
    );
  };

  const productPallets = pallets.filter(p => p.type === 'Product');
  const rawPallets = pallets.filter(p => p.type === 'Raw');
  const allPallets = pallets;

  const renderPalletTable = (palletList: Pallet[]) => (
    <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead className="w-[80px]">Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total Qty</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Months Left</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              </TableRow>
            ))
          ) : palletList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No pallets found.
              </TableCell>
            </TableRow>
          ) : (
            palletList.map((pallet) => {
              const palletNumber = pallet.id.split('-').pop() || '000000';
              return (
                <TableRow key={pallet.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold">#{palletNumber}</span>
                      <span className="text-xs text-muted-foreground">{pallet.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {pallet.type === 'Product' ? (
                        <Package className="h-3 w-3" />
                      ) : (
                        <PackageOpen className="h-3 w-3" />
                      )}
                      {pallet.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {pallet.locationId}
                    </div>
                  </TableCell>
                  <TableCell>{pallet.products.length}</TableCell>
                  <TableCell className="font-semibold">
                    {pallet.totalQuantity.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {pallet.expiryDate ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(pallet.expiryDate)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getExpiryBadge(pallet.monthsUntilExpiry)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Pallet List</DialogTitle>
          <DialogDescription>
            View all pallets with their details and expiry information.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All Pallets ({allPallets.length})
            </TabsTrigger>
            <TabsTrigger value="product">
              Finished Products ({productPallets.length})
            </TabsTrigger>
            <TabsTrigger value="raw">
              Raw Materials ({rawPallets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {renderPalletTable(allPallets)}
          </TabsContent>

          <TabsContent value="product" className="mt-4">
            {renderPalletTable(productPallets)}
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            {renderPalletTable(rawPallets)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
