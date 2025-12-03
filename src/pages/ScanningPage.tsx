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
import { Scan, Package, ShoppingCart, Truck, CheckCircle, AlertCircle, Search, Camera } from "lucide-react";
import { toast, Toaster } from "sonner";
import { api } from "@/lib/api-client";
import { Product, Order, Shipment, Pallet } from "@shared/types";
import { PalletScanDialog } from "@/components/wms/PalletScanDialog";
import jsQR from "jsqr";

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
  const [cameraScanning, setCameraScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Auto-focus input when page loads
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Capture refs at effect creation time for cleanup
    const videoEl = videoRef.current;
    const intervalId = scanIntervalRef.current;

    // Cleanup camera and scanning interval on unmount
    return () => {
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
      }

      if (intervalId) {
        clearInterval(intervalId);
        scanIntervalRef.current = null;
      }
    };
  }, []);

  const startCameraScan = async () => {
    try {
      setCameraScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use rear camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        toast.info("Camera activated - scanning for QR codes...");
        
        // Start continuous scanning
        scanIntervalRef.current = window.setInterval(() => {
          scanQRCode();
        }, 500); // Scan every 500ms
      }
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error("Unable to access camera. Please check permissions.");
      setCameraScanning(false);
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Clear scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setCameraScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Scan for QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      // Validate if it's a company QR code
      const isValidCompanyCode = 
        code.data.startsWith('PROD-') || 
        code.data.startsWith('ORD-') || 
        code.data.startsWith('SHP-') || 
        code.data.startsWith('PLT-');
      
      if (isValidCompanyCode) {
        // Valid company QR code detected!
        toast.success("Company QR code detected!");
        stopCameraScan();
        
        // Populate input field with decoded data
        setScanInput(code.data);
        
        // Automatically trigger scan
        handleScan(code.data);
      } else {
        // Invalid QR code - not a company code
        toast.warning(`Invalid QR code: ${code.data.substring(0, 20)}... Only company codes allowed (PROD-*, ORD-*, SHP-*, PLT-*)`);
      }
    }
  };

  const captureAndScan = () => {
    // Manual capture - try to scan once
    scanQRCode();
    
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (!code) {
      toast.warning("No QR code detected. Please try again or enter code manually.");
      stopCameraScan();
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    // Cleanup camera on unmount
    return () => {
      stopCameraScan();
    };
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
              <div className="flex items-end gap-2">
                <Button 
                  onClick={() => handleScan(scanInput)}
                  disabled={!scanInput.trim() || scanning}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Lookup
                </Button>
                <Button 
                  variant="outline"
                  onClick={cameraScanning ? stopCameraScan : startCameraScan}
                  disabled={scanning}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {cameraScanning ? 'Stop' : 'Scan QR'}
                </Button>
              </div>
            </div>

            {/* Camera Preview */}
            {cameraScanning && (
              <Card className="border-2 border-primary">
                <CardContent className="p-4 space-y-3">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video 
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      playsInline
                    />
                    <div className="absolute inset-0 border-4 border-primary/30 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-4 border-primary rounded-lg"></div>
                    </div>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/75 text-white px-4 py-2 rounded-full text-sm">
                      <Scan className="inline h-4 w-4 mr-2 animate-pulse" />
                      Scanning...
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={stopCameraScan}
                      className="flex-1"
                    >
                      Stop Scanning
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    QR codes will be automatically detected and scanned
                  </p>
                </CardContent>
              </Card>
            )}

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
