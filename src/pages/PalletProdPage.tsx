import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Calendar, AlertTriangle, Box } from "lucide-react";
import { api } from "@/lib/api-client";
import { Pallet } from "@shared/types";
import { Toaster, toast } from "sonner";

export function PalletProdPage() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPallets = async () => {
      try {
        setLoading(true);
        const data = await api<Pallet[]>('/api/wms/pallets');
        // Filter for Product type pallets only
        const productPallets = data.filter(p => p.type === 'Product');
        setPallets(productPallets);
      } catch (error) {
        toast.error("Failed to load pallet data.");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPallets();
  }, []);

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

  return (
    <AppLayout container>
      <PageHeader 
        title="PalletProd" 
        subtitle="Manage finished product pallets ready for distribution." 
      />
      
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
      ) : pallets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No pallets found. Add products to create pallets.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {pallets.map((pallet) => (
            <Card key={pallet.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{pallet.id}</CardTitle>
                  </div>
                  <Badge className={getStatusColor(pallet.status)}>
                    {pallet.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <MapPin className="h-4 w-4" />
                  Location: {pallet.locationId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Created: {formatDate(pallet.createdDate)}
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Box className="h-4 w-4" />
                  <span className="font-semibold">Total Quantity:</span>
                  <span>{pallet.totalQuantity.toLocaleString()} units</span>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Products ({pallet.products.length})
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
                            Batch: {product.batchCode}
                          </div>
                        )}

                        {product.allergens && product.allergens !== 'None' && (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            Allergens: {product.allergens}
                          </div>
                        )}

                        {product.expiryDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Expires: {formatDate(product.expiryDate)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Toaster richColors />
    </AppLayout>
  );
}
