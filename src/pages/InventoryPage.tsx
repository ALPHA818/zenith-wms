import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Product, ProductFormData, Location } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormSheet } from "@/components/wms/ProductFormSheet";
import { useAuthStore } from "@/stores/authStore";
import { differenceInDays, parseISO } from 'date-fns';
import { useIsMobile } from "@/hooks/use-mobile";
export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:inventory') ?? false;
  const isMobile = useIsMobile();
  const locationsMap = useMemo(() => {
    return new Map(locations.map(loc => [loc.id, loc.name]));
  }, [locations]);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsData, locationsData] = await Promise.all([
        api<Product[]>('/api/wms/inventory'),
        api<Location[]>('/api/wms/locations')
      ]);
      setProducts(productsData);
      setLocations(locationsData);
    } catch (error) {
      toast.error("Failed to fetch inventory data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsSheetOpen(true);
  };
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsSheetOpen(true);
  };
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await api(`/api/wms/inventory/${productToDelete.id}`, { method: 'DELETE' });
      toast.success(`Product "${productToDelete.name}" deleted successfully.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete product.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };
  const handleFormSubmit = async (data: ProductFormData) => {
    try {
      if (selectedProduct) {
        await api(`/api/wms/inventory/${selectedProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        toast.success(`Product "${data.name}" updated successfully.`);
      } else {
        await api('/api/wms/inventory', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        toast.success(`Product "${data.name}" created successfully.`);
      }
      setIsSheetOpen(false);
      fetchData();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save product: ${errorMessage}`);
      console.error(error);
    }
  };
  const getBadgeVariant = (status: Product['status']) => {
    switch (status) {
      case 'In Stock': return 'default';
      case 'Low Stock': return 'secondary';
      case 'Out of Stock': return 'destructive';
      default: return 'outline';
    }
  };
  const getExpiryStatus = (expiryDate?: string): { text: string; variant: 'destructive' | 'secondary' | 'default' } | null => {
    if (!expiryDate) return null;
    const daysUntilExpiry = differenceInDays(parseISO(expiryDate), new Date());
    if (daysUntilExpiry < 0) {
      return { text: 'Expired', variant: 'destructive' };
    }
    if (daysUntilExpiry <= 7) {
      return { text: 'Expiring Soon', variant: 'secondary' };
    }
    return null;
  };
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const renderActions = (product: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditProduct(product)}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteClick(product)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <AppLayout container>
      <PageHeader title="Food Inventory Management" subtitle="View and manage your food product stock.">
        {canManage && (
          <Button onClick={handleAddProduct} className="hover:shadow-md transition-shadow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Food Item
          </Button>
        )}
      </PageHeader>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by food item or SKU..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        isMobile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: canManage ? 10 : 9 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: canManage ? 10 : 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : isMobile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.length > 0 ? filteredProducts.map(product => {
            const expiryStatus = getExpiryStatus(product.expiryDate);
            return (
              <Card key={product.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{product.id}</p>
                  </div>
                  {canManage && renderActions(product)}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Status:</span> <Badge variant={getBadgeVariant(product.status)}>{product.status}</Badge></div>
                  <div className="flex justify-between"><span>Quantity:</span> <strong>{product.quantity}</strong></div>
                  <div className="flex justify-between"><span>Location:</span> <span>{locationsMap.get(product.locationId) || product.locationId}</span></div>
                  <div className="flex justify-between items-center">
                    <span>Expiry:</span>
                    {product.expiryDate ? (
                      <div className="flex items-center gap-2">
                        {new Date(product.expiryDate).toLocaleDateString()}
                        {expiryStatus && <Badge variant={expiryStatus.variant}>{expiryStatus.text}</Badge>}
                      </div>
                    ) : 'N/A'}
                  </div>
                </CardContent>
              </Card>
            );
          }) : <p className="text-center col-span-full py-12">No products found.</p>}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead><TableHead>Product Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Expiry Date</TableHead><TableHead>Batch Code</TableHead><TableHead>Allergens</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const expiryStatus = getExpiryStatus(product.expiryDate);
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.id}</TableCell><TableCell>{product.name}</TableCell><TableCell>{product.category}</TableCell><TableCell className="text-right">{product.quantity}</TableCell><TableCell>{locationsMap.get(product.locationId) || product.locationId}</TableCell>
                      <TableCell><Badge variant={getBadgeVariant(product.status)}>{product.status}</Badge></TableCell>
                      <TableCell>
                        {product.expiryDate ? (
                          <div className="flex items-center gap-2">
                            {new Date(product.expiryDate).toLocaleDateString()}
                            {expiryStatus && <Badge variant={expiryStatus.variant}>{expiryStatus.text}</Badge>}
                          </div>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>{product.storageTemp}</TableCell><TableCell>{product.allergens}</TableCell>
                      {canManage && <TableCell className="text-right">{renderActions(product)}</TableCell>}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={canManage ? 10 : 9} className="h-24 text-center">No products found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage && (
        <ProductFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} product={selectedProduct} />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the product "{productToDelete?.name}" from your inventory.</AlertDialogDescription>
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