// Create a complete React and TypeScript implementation for a QR code-based pallet moving feature.
// The implementation is self-contained in this single file for demonstration. It includes two components:
// 1. A `PalletScannerModal` component for handling the scanning logic.
// 2. A `LocationsPage` component that uses the modal.

import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

// --- MOCK IMPLEMENTATIONS (for demonstration purposes) ---

// Mock for shadcn/ui Dialog and Button components
const Dialog = ({ children, open }: { children: React.ReactNode, open: boolean }) => open ? (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
    {children}
  </div>
) : null;
const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: '#111', padding: '1.5rem', border: '1px solid #888', minWidth: 360, maxWidth: 640, borderRadius: 8 }}>
    {children}
  </div>
);
const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{ background: '#2563eb', color: 'white', padding: '10px 14px', margin: '5px', border: 'none', borderRadius: 6, cursor: 'pointer' }} />
);

// Mock for sonner toast notifications
const toast = { success: (message: string) => alert(message), error: (message: string) => alert(message) };

// Mock for your API client
const apiClient = {
  post: async (url: string, body: object) => {
    console.log('Making API POST request to:', url, 'with body:', body);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true } as { success: boolean };
  }
};

// --- COMPONENT 1: PalletScannerModal ---

interface PalletScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScannerStep = 'scan-pallet' | 'scan-location' | 'confirm';

/**
 * @name PalletScannerModal
 * @description A modal component that uses the device camera to scan pallet and location QR codes to register a pallet move.
 */
function PalletScannerModal({ isOpen, onClose }: PalletScannerModalProps) {
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
    // Accept raw strings; if prefixed like PALLET:ABC or LOCATION:XYZ, strip prefix.
    const idx = data.indexOf(':');
    if (idx > 0) {
      return data.slice(idx + 1).trim();
    }
    return data.trim();
  };

  // Start/stop camera and scanning when modal opens/closes
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
              setCooldown(10); // ~10 frames cooldown before next detection
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (isOpen) {
      // Reset state when opening
      setStep('scan-pallet');
      setPalletId(null);
      setLocationId(null);
      start();
    } else {
      stop();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const title = step === 'scan-pallet' ? 'Scan Pallet' : step === 'scan-location' ? 'Scan Location' : 'Confirm Move';

  const handleConfirm = async () => {
    if (!palletId || !locationId) {
      toast.error('Missing pallet or location');
      return;
    }
    try {
      const res = await apiClient.post('/api/wms/pallets/move', { palletId, locationId, source: 'scanner' });
      if (res && (res as any).success) {
        toast.success('Pallet move registered');
        onClose();
      } else {
        toast.error('Failed to register move');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error registering move');
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}
        {step !== 'confirm' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 6, border: '1px solid #333' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ fontSize: 12, color: '#aaa' }}>{scanning ? 'Scanning…' : 'Camera stopped'}</div>
            <div style={{ fontSize: 13 }}>
              Pallet: <b>{palletId || '—'}</b> · Location: <b>{locationId || '—'}</b>
            </div>
            <div>
              <Button onClick={onClose}>Cancel</Button>
              {step === 'scan-location' && (
                <Button onClick={() => { setStep('scan-pallet'); setPalletId(null); }}>Rescan Pallet</Button>
              )}
            </div>
          </div>
        )}
        {step === 'confirm' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div>Pallet ID: <b>{palletId}</b></div>
              <div>Location ID: <b>{locationId}</b></div>
            </div>
            <Button onClick={handleConfirm}>Confirm Move</Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- COMPONENT 2: LocationsPage ---
/**
 * @name LocationsPage
 * @description A parent page that demonstrates how to use the `PalletScannerModal`.
 */
export default function LocationsPage() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <h1>Locations</h1>
      <p>Use your camera to scan a pallet QR followed by a location QR to register a move.</p>
      <Button onClick={() => setIsScannerOpen(true)}>Register Pallet Move</Button>
      <PalletScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
    </div>
  );
}
