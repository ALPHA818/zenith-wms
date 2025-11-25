import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Calendar, Thermometer, AlertTriangle, Box } from "lucide-react";
import { api } from "@/lib/api-client";
import { Product } from "@shared/types";
import { Toaster, toast } from "sonner";

interface Pallet {
  id: string;
  products: Product[];
  location: string;
  createdDate: string;
  totalQuantity: number;
  status: 'Ready' | 'In Transit' | 'Delivered';
}

export function PalletProdPage() {
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPallets = async () => {
      try {
        setLoading(true);
        // Fetch all products and group them into pallets
        const products = await api<Product[]>('/api/wms/inventory');
        
        // Create pallets with 1-5 products each (randomly distributed)
        const palletData: Pallet[] = [];
        let productIndex = 0;
        let palletCounter = 1;
        
        while (productIndex < products.length) {
          // Randomly choose 1-5 products per pallet (or remaining products if less than 5)
          const remainingProducts = products.length - productIndex;
          const productsInThisPallet = Math.min(
            Math.floor(Math.random() * 5) + 1, // Random number between 1-5
            remainingProducts
          );
          
          const palletProducts = products.slice(productIndex, productIndex + productsInThisPallet);
          palletData.push({
            id: `PLT-PROD-${String(palletCounter).padStart(3, '0')}`,
            products: palletProducts,
            location: palletProducts[0]?.locationId || 'Unknown',
            createdDate: new Date().toISOString(),
            totalQuantity: palletProducts.reduce((sum, p) => sum + p.quantity, 0),
            status: palletCounter % 3 === 0 ? 'Ready' : palletCounter % 3 === 1 ? 'In Transit' : 'Delivered',
          });
          
          productIndex += productsInThisPallet;
          palletCounter++;
        }
        
        setPallets(palletData);
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
                  Location: {pallet.location}
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

                        {product.storageTemp && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Box className="h-3 w-3" />
                            Batch: {product.storageTemp}
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
