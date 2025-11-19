import React from 'react';
import { Order, OrderStatus, ORDER_STATUSES } from '@shared/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}
export function OrderDetailsDialog({ isOpen, onClose, order, onStatusChange }: OrderDetailsDialogProps) {
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:orders') ?? false;
  if (!order) return null;
  const getStatusVariant = (status: Order['status']) => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'Processing': return 'default';
      case 'Shipped': return 'outline';
      case 'Delivered': return 'default';
      case 'Cancelled': return 'destructive';
      default: return 'outline';
    }
  };
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Details: {order.id}</DialogTitle>
          <DialogDescription>
            Details for the {order.type} order placed by {order.customerName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <span className="font-semibold text-muted-foreground">Customer/Supplier:</span>
            <p>{order.customerName}</p>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground">Order Date:</span>
            <p>{new Date(order.date).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground">Status:</span>
            <p><Badge variant={getStatusVariant(order.status)}>{order.status}</Badge></p>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground">Total Items:</span>
            <p>{itemCount}</p>
          </div>
        </div>
        {canManage && (
          <div className="mt-2 space-y-2">
            <Label htmlFor="status-select">Change Order Status</Label>
            <Select
              defaultValue={order.status}
              onValueChange={(value: OrderStatus) => onStatusChange(order.id, value)}
            >
              <SelectTrigger id="status-select">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Line Items</h4>
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product ID</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.productId}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}