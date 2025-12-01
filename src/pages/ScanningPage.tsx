import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Scan, Package, ShoppingCart, Truck, CheckCircle, AlertCircle, Search } from "lucide-react";
import { toast, Toaster } from "sonner";
import { api } from "@/lib/api-client";
import { Product, Order, Shipment, Pallet } from "@shared/types";
import { PalletScanDialog } from "@/components/wms/PalletScanDialog";

type ScanResult = {
  type: 'product' | 'order' | 'shipment' | 'pallet' | 'unknown';
  data: Product | Order | Shipment | Pallet | null;
  code: string;
  timestamp: Date;
};

export function ScanningPage() {
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [palletDialogOpen, setPalletDialogOpen] = useState(false);
  const [scannedPallet, setScannedPallet] = useState<Pallet | null>(null);

  useEffect(() => {
    // Auto-focus input when page loads
    inputRef.current?.focus();
  }, []);

  const handleScan = async (code: string) => {
    if (!code.trim()) return;

    setScanning(true);
    const timestamp = new Date();

    try {
      // Try to identify what was scanned based on the code pattern
      let result: ScanResult = {
        type: 'unknown',
        data: null,
        code: code.trim(),
        timestamp,
      };

      // Check if it's a product (PROD-*)
      if (code.startsWith('PROD-')) {
        try {
          const products = await api<Product[]>('/api/wms/inventory');
          const product = products.find(p => p.id === code);
          if (product) {
            result = { type: 'product', data: product, code, timestamp };
            toast.success(`Product found: ${product.name}`);
          } else {
            toast.error(`Product ${code} not found`);
          }
        } catch (error) {
          console.error(error);
          toast.error("Failed to fetch product");
        }
      }
      // Check if it's an order (ORD-*)
      else if (code.startsWith('ORD-')) {
        try {
          const orders = await api<Order[]>('/api/wms/orders');
          const order = orders.find(o => o.id === code);
          if (order) {
            result = { type: 'order', data: order, code, timestamp };
            toast.success(`Order found: ${order.customerName}`);
          } else {
            toast.error(`Order ${code} not found`);
          }
        } catch (error) {
          console.error(error);
          toast.error("Failed to fetch order");
        }
      }
      // Check if it's a shipment (SHP-*)
      else if (code.startsWith('SHP-')) {
        try {
          const shipments = await api<Shipment[]>('/api/wms/shipments');
          const shipment = shipments.find(s => s.id === code);
          if (shipment) {
            result = { type: 'shipment', data: shipment, code, timestamp };
            toast.success(`Shipment found: ${shipment.trackingNumber}`);
          } else {
            toast.error(`Shipment ${code} not found`);
          }
        } catch (error) {
          console.error(error);
          toast.error("Failed to fetch shipment");
        }
      }
      // Check if it's a pallet (PLT-*)
      else if (code.startsWith('PLT-')) {
        try {
          const pallets = await api<Pallet[]>('/api/wms/pallets');
          const pallet = pallets.find(p => p.id === code);
          if (pallet) {
            result = { type: 'pallet', data: pallet, code, timestamp };
            setScannedPallet(pallet);
            setPalletDialogOpen(true);
            toast.success(`Pallet found: ${pallet.id}`);
          } else {
            toast.error(`Pallet ${code} not found`);
          }
        } catch (error) {
          console.error(error);
          toast.error("Failed to fetch pallet");
        }
      }
      // Unknown code format
      else {
        toast.warning(`Unrecognized code format: ${code}`);
      }

      setLastScan(result);
      setScanHistory(prev => [result, ...prev].slice(0, 20)); // Keep last 20 scans
      setScanInput("");
    } finally {
      setScanning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan(scanInput);
    }
  };

  const renderProductDetails = (product: Product) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">{product.name}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">SKU:</span>
          <span className="ml-2 font-mono">{product.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Category:</span>
          <span className="ml-2">{product.category}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Quantity:</span>
          <span className="ml-2 font-semibold">{product.quantity}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>
          <Badge className="ml-2" variant={product.status === 'In Stock' ? 'default' : product.status === 'Low Stock' ? 'secondary' : 'destructive'}>
            {product.status}
          </Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Location:</span>
          <span className="ml-2">{product.locationId}</span>
        </div>
        {product.expiryDate && (
          <div>
            <span className="text-muted-foreground">Expiry:</span>
            <span className="ml-2">{new Date(product.expiryDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderOrderDetails = (order: Order) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">{order.id}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Customer:</span>
          <span className="ml-2">{order.customerName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Type:</span>
          <Badge className="ml-2" variant="outline">{order.type}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>
          <Badge className="ml-2">{order.status}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Items:</span>
          <span className="ml-2 font-semibold">{order.itemCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Carrier:</span>
          <span className="ml-2">{order.carrier}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Date:</span>
          <span className="ml-2">{new Date(order.date).toLocaleDateString()}</span>
        </div>
      </div>
      <Separator />
      <div>
        <h4 className="font-medium mb-2">Order Items:</h4>
        <ul className="space-y-1 text-sm">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{item.productName}</span>
              <span className="text-muted-foreground">Qty: {item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const renderShipmentDetails = (shipment: Shipment) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">{shipment.id}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Tracking:</span>
          <span className="ml-2 font-mono text-xs">{shipment.trackingNumber}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Carrier:</span>
          <span className="ml-2">{shipment.carrier}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>
          <Badge className="ml-2">{shipment.status}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Order:</span>
          <span className="ml-2">{shipment.orderId}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Origin:</span>
          <span className="ml-2">{shipment.origin}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Destination:</span>
          <span className="ml-2">{shipment.destination}</span>
        </div>
      </div>
      <Separator />
      <div className="flex items-center gap-2 text-sm">
        {shipment.dispatchInspection && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Dispatch Inspected
          </Badge>
        )}
        {shipment.receivingInspection && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Receiving Inspected
          </Badge>
        )}
      </div>
    </div>
  );

  const renderPalletDetails = (pallet: Pallet) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">{pallet.id}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Type:</span>
          <Badge className="ml-2" variant="outline">{pallet.type}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Location:</span>
          <span className="ml-2">{pallet.locationId}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Units:</span>
          <span className="ml-2 font-semibold">{pallet.totalQuantity}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Products:</span>
          <span className="ml-2">{pallet.products.length}</span>
        </div>
        {pallet.expiryDate && (
          <div>
            <span className="text-muted-foreground">Expiry:</span>
            <span className="ml-2">{new Date(pallet.expiryDate).toLocaleDateString()}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Created:</span>
          <span className="ml-2">{new Date(pallet.createdDate).toLocaleDateString()}</span>
        </div>
      </div>
      <Separator />
      <div>
        <h4 className="font-medium mb-2">Products on Pallet:</h4>
        <ul className="space-y-1 text-sm">
          {pallet.products.map((product, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{product.name}</span>
              <span className="text-muted-foreground">Qty: {product.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <AppLayout container>
      <PageHeader 
        title="Barcode Scanner" 
        subtitle="Scan barcodes to quickly lookup products, orders, and shipments"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scanner Input Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Scanner Input
            </CardTitle>
            <CardDescription>
              Scan a barcode or manually enter the code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="scan-input">Barcode / QR Code</Label>
                <Input
                  id="scan-input"
                  ref={inputRef}
                  type="text"
                  placeholder="Scan or type code (e.g., PROD-APL-01, ORD-001, SHP-101)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={scanning}
                  className="font-mono mt-1"
                  autoFocus
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={() => handleScan(scanInput)}
                  disabled={!scanInput.trim() || scanning}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Lookup
                </Button>
              </div>
            </div>

            {/* Last Scan Result */}
            {lastScan && (
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {lastScan.type === 'product' && <Package className="h-4 w-4" />}
                    {lastScan.type === 'order' && <ShoppingCart className="h-4 w-4" />}
                    {lastScan.type === 'shipment' && <Truck className="h-4 w-4" />}
                    {lastScan.type === 'unknown' && <AlertCircle className="h-4 w-4" />}
                    {lastScan.type === 'unknown' ? 'Unknown Code' : 'Scan Result'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Scanned at {lastScan.timestamp.toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lastScan.data && lastScan.type === 'product' && renderProductDetails(lastScan.data as Product)}
                  {lastScan.data && lastScan.type === 'order' && renderOrderDetails(lastScan.data as Order)}
                  {lastScan.data && lastScan.type === 'shipment' && renderShipmentDetails(lastScan.data as Shipment)}
                  {lastScan.data && lastScan.type === 'pallet' && renderPalletDetails(lastScan.data as Pallet)}
                  {!lastScan.data && (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Code "{lastScan.code}" not found in system</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Scan History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan History</CardTitle>
            <CardDescription>Recent scans</CardDescription>
          </CardHeader>
          <CardContent>
            {scanHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Scan className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No scans yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scanHistory.map((scan, idx) => (
                  <div 
                    key={idx}
                    className="p-2 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setLastScan(scan)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {scan.type === 'product' && <Package className="h-4 w-4" />}
                        {scan.type === 'order' && <ShoppingCart className="h-4 w-4" />}
                        {scan.type === 'shipment' && <Truck className="h-4 w-4" />}
                        {scan.type === 'pallet' && <Package className="h-4 w-4 text-blue-600" />}
                        {scan.type === 'unknown' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        <span className="font-mono text-sm">{scan.code}</span>
                      </div>
                      <Badge variant={scan.data ? "default" : "destructive"} className="text-xs">
                        {scan.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scan.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PalletScanDialog
        isOpen={palletDialogOpen}
        onClose={() => {
          setPalletDialogOpen(false);
          setScannedPallet(null);
        }}
        pallet={scannedPallet}
        onUpdatePallet={() => {
          // Refresh data if needed
          if (scannedPallet) {
            handleScan(scannedPallet.id);
          }
        }}
      />

      <Toaster richColors />
    </AppLayout>
  );
}
