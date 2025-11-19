import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { Order, OrderStatus, OrderType, OrderFormData, Product } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderFormSheet } from "@/components/wms/OrderFormSheet";
import { useAuthStore } from "@/stores/authStore";
import { OrderDetailsDialog } from "@/components/wms/OrderDetailsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case 'Pending': return 'secondary';
    case 'Processing': return 'default';
    case 'Shipped': return 'outline';
    case 'Delivered': return 'default';
    case 'Cancelled': return 'destructive';
    default: return 'outline';
  }
};
const OrderTable = ({ orders, loading, onEdit, onDelete, onView, canManage, isMobile }: { orders: Order[], loading: boolean, onEdit: (order: Order) => void, onDelete: (order: Order) => void, onView: (order: Order) => void, canManage: boolean, isMobile: boolean }) => {
  const renderActions = (order: Order) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(order)}><Eye className="mr-2 h-4 w-4" /><span>View Details</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(order)}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(order)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  if (loading) {
    return isMobile ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
        ))}
      </div>
    ) : (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader><TableRow>{Array.from({ length: canManage ? 6 : 5 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}</TableRow></TableHeader>
          <TableBody>{Array.from({ length: 3 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: canManage ? 6 : 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>))}</TableBody>
        </Table>
      </div>
    );
  }
  if (orders.length === 0) {
    return <div className="text-center py-12">No orders found.</div>;
  }
  return isMobile ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {orders.map(order => (
        <Card key={order.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">{order.id}</CardTitle>
              <p className="text-sm text-muted-foreground">{order.customerName}</p>
            </div>
            {canManage && renderActions(order)}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Status:</span> <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge></div>
            <div className="flex justify-between"><span>Date:</span> <span>{new Date(order.date).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span>Items:</span> <strong>{order.itemCount}</strong></div>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead><TableHead>Customer/Supplier</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Item Count</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.id}</TableCell><TableCell>{order.customerName}</TableCell><TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={getStatusVariant(order.status)}>{order.status}</Badge></TableCell>
              <TableCell className="text-right">{order.itemCount}</TableCell>
              {canManage && <TableCell className="text-right">{renderActions(order)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:orders') ?? false;
  const isMobile = useIsMobile();
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersData, productsData] = await Promise.all([
        api<Order[]>('/api/wms/orders'),
        api<Product[]>('/api/wms/inventory')
      ]);
      setOrders(ordersData);
      setProducts(productsData);
    } catch (error) {
      toast.error("Failed to fetch data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleAddOrder = () => { setSelectedOrder(null); setIsSheetOpen(true); };
  const handleEditOrder = (order: Order) => { setSelectedOrder(order); setIsSheetOpen(true); };
  const handleDeleteClick = (order: Order) => { setOrderToDelete(order); setIsDeleteDialogOpen(true); };
  const handleViewDetails = (order: Order) => { setViewingOrder(order); setIsDetailsDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    try {
      await api(`/api/wms/orders/${orderToDelete.id}`, { method: 'DELETE' });
      toast.success(`Order "${orderToDelete.id}" deleted successfully.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete order.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };
  const handleFormSubmit = async (data: OrderFormData) => {
    try {
      const method = selectedOrder ? 'PUT' : 'POST';
      const url = selectedOrder ? `/api/wms/orders/${selectedOrder.id}` : '/api/wms/orders';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`Order "${data.id}" ${selectedOrder ? 'updated' : 'created'} successfully.`);
      setIsSheetOpen(false);
      fetchData();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save order: ${errorMessage}`);
      console.error(error);
    }
  };
  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      await api(`/api/wms/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Order ${orderId} status updated to ${status}.`);
      fetchData(); // Refresh both orders and products
      setIsDetailsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update order status.");
      console.error(error);
    }
  };
  const filterOrders = (type: OrderType) => orders.filter(order => order.type === type);
  return (
    <AppLayout container>
      <PageHeader title="Order Processing" subtitle="Manage sales and purchase orders.">
        {canManage && (
          <Button onClick={handleAddOrder} className="hover:shadow-md transition-shadow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Order
          </Button>
        )}
      </PageHeader>
      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="sales">Sales Orders</TabsTrigger>
          <TabsTrigger value="purchase">Purchase Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="mt-6">
          <OrderTable orders={filterOrders('Sales')} loading={loading} onEdit={handleEditOrder} onDelete={handleDeleteClick} onView={handleViewDetails} canManage={canManage} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="purchase" className="mt-6">
          <OrderTable orders={filterOrders('Purchase')} loading={loading} onEdit={handleEditOrder} onDelete={handleDeleteClick} onView={handleViewDetails} canManage={canManage} isMobile={isMobile} />
        </TabsContent>
      </Tabs>
      {canManage && (
        <OrderFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} order={selectedOrder} products={products} />
      )}
      <OrderDetailsDialog isOpen={isDetailsDialogOpen} onClose={() => setIsDetailsDialogOpen(false)} order={viewingOrder} onStatusChange={handleStatusChange} />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete order "{orderToDelete?.id}".</AlertDialogDescription>
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