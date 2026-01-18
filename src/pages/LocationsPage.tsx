import React, { useEffect, useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Location, LocationFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { LocationFormSheet } from "@/components/wms/LocationFormSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import jsQR from "jsqr";
export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:location-ids') ?? false;
  const isMobile = useIsMobile();
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<Location[]>('/api/wms/locations');
      setLocations(data);
    } catch (error) {
      toast.error("Failed to fetch locations.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);
  const handleAddLocation = () => { setSelectedLocation(null); setIsSheetOpen(true); };
  const handleEditLocation = (location: Location) => { setSelectedLocation(location); setIsSheetOpen(true); };
  const handleDeleteClick = (location: Location) => { setLocationToDelete(location); setIsDeleteDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;
    try {
      await api(`/api/wms/locations/${locationToDelete.id}`, { method: 'DELETE' });
      toast.success(`Location "${locationToDelete.name}" deleted successfully.`);
      fetchLocations();
    } catch (error) {
      toast.error("Failed to delete location.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };
  const handleFormSubmit = async (data: LocationFormData) => {
    try {
      const method = selectedLocation ? 'PUT' : 'POST';
      const url = selectedLocation ? `/api/wms/locations/${selectedLocation.id}` : '/api/wms/locations';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`Location "${data.name}" ${selectedLocation ? 'updated' : 'created'} successfully.`);
      setIsSheetOpen(false);
      fetchLocations();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save location: ${errorMessage}`);
      console.error(error);
    }
  };
  const renderActions = (location: Location) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditLocation(location)}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteClick(location)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <AppLayout container>
      <PageHeader title="Location Management" subtitle="Organize your physical warehouse structure.">
        {canManage && (
          <Button onClick={handleAddLocation} className="hover:shadow-md transition-shadow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Location
          </Button>
        )}
        <div className="ml-2 inline-flex">
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>Register Pallet Move</Button>
        </div>
      </PageHeader>
      {loading ? (
        isMobile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow>{Array.from({ length: canManage ? 5 : 4 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}</TableRow></TableHeader>
              <TableBody>{Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: canManage ? 5 : 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>))}</TableBody>
            </Table>
          </div>
        )
      ) : locations.length === 0 ? (
        <div className="text-center py-12">No locations found.</div>
      ) : isMobile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map(location => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{location.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{location.id}</p>
                </div>
                {canManage && renderActions(location)}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Type:</span> <Badge variant="outline">{location.type}</Badge></div>
                {location.description && <p className="text-muted-foreground pt-2">{location.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.id}</TableCell><TableCell>{location.name}</TableCell>
                  <TableCell><Badge variant="outline">{location.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{location.description}</TableCell>
                  {canManage && <TableCell className="text-right">{renderActions(location)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage && (
        <LocationFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} location={selectedLocation} />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the location "{locationToDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Scanner Modal */}
      <PalletScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
      <Toaster richColors />
    </AppLayout>
  );
}

type ScannerStep = 'scan-pallet' | 'scan-location' | 'confirm';

function PalletScannerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<ScannerStep>('scan-pallet');
  const [palletId, setPalletId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const parseCode = (data: string): string => {
    const idx = data.indexOf(':');
    if (idx > 0) return data.slice(idx + 1).trim();
    return data.trim();
  };

  useEffect(() => {
    const start = async () => {
      try {
        setError(null);
        setScanning(true);
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const scanLoop = () => {
          if (!videoRef.current || !canvasRef.current) {
            rafRef.current = requestAnimationFrame(scanLoop);
            return;
          }
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth && video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            if (code && code.data && cooldown === 0) {
              const val = parseCode(code.data);
              if (step === 'scan-pallet') {
                setPalletId(val);
                setStep('scan-location');
              } else if (step === 'scan-location') {
                setLocationId(val);
                setStep('confirm');
              }
              setCooldown(10);
            }
            if (cooldown > 0) setCooldown(cooldown - 1);
          }
          rafRef.current = requestAnimationFrame(scanLoop);
        };
        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (e: any) {
        console.error(e);
        setError('Unable to access camera. Please allow camera permissions.');
      }
    };

    const stop = () => {
      setScanning(false);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const s = streamRef.current;
      if (s) { s.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (videoRef.current) { videoRef.current.srcObject = null; }
    };

    if (isOpen) {
      setStep('scan-pallet');
      setPalletId(null);
      setLocationId(null);
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [isOpen, step, cooldown]);

  const handleConfirm = async () => {
    if (!palletId || !locationId) {
      toast.error('Missing pallet or location');
      return;
    }
    try {
      await api('/api/wms/pallets/move', { method: 'POST', body: JSON.stringify({ palletId, locationId, source: 'scanner' }) });
      toast.success('Pallet move registered');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Error registering move');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'scan-pallet' ? 'Scan Pallet' : step === 'scan-location' ? 'Scan Location' : 'Confirm Move'}</DialogTitle>
          <DialogDescription>Use your camera to scan QR codes and register a move.</DialogDescription>
        </DialogHeader>
        {step !== 'confirm' ? (
          <div className="space-y-2">
            <video ref={videoRef} className="w-full rounded border" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="text-xs text-muted-foreground">{scanning ? 'Scanning…' : 'Camera stopped'}</div>
            <div className="text-sm">Pallet: <span className="font-mono">{palletId || '—'}</span> · Location: <span className="font-mono">{locationId || '—'}</span></div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              {step === 'scan-location' && (
                <Button onClick={() => { setStep('scan-pallet'); setPalletId(null); }}>Rescan Pallet</Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-2">
            <div>Pallet ID: <span className="font-mono">{palletId}</span></div>
            <div>Location ID: <span className="font-mono">{locationId}</span></div>
            <DialogFooter>
              <Button onClick={handleConfirm}>Confirm Move</Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}