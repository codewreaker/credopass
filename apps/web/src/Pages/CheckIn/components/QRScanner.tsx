import { useEffect, useRef, useState } from 'react';
import { CameraOff, ScanLine } from 'lucide-react';

interface QRScannerProps {
  /** Fires with the decoded QR text; deduped so a held code fires once. */
  onResult: (value: string) => void;
  /** Paused while a success screen is up, so we don't re-fire mid-celebration. */
  paused?: boolean;
  className?: string;
}

// BarcodeDetector is not in the TS DOM lib yet; declare the slice we use.
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

const getDetectorCtor = (): BarcodeDetectorCtor | null =>
  (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;

type ScannerState = 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error';

/**
 * Camera QR scanner built on the native BarcodeDetector API — no dependency.
 * Chrome/Android decode natively; Safari/Firefox lack BarcodeDetector, so we
 * show a clear fallback pointing to manual check-in.
 */
export function QRScanner({ onResult, paused = false, className }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Detect support at mount so we never setState synchronously in an effect.
  const [state, setState] = useState<ScannerState>(() => (getDetectorCtor() ? 'starting' : 'unsupported'));

  // Ref mirrors of props so the scan loop reads the latest without restarting.
  const pausedRef = useRef(paused);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    pausedRef.current = paused;
    onResultRef.current = onResult;
  });

  useEffect(() => {
    const Ctor = getDetectorCtor();
    if (!Ctor) return undefined;

    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    let lastValue = '';
    let lastAt = 0;
    const detector = new Ctor({ formats: ['qr_code'] });

    const tick = async () => {
      const video = videoRef.current;
      if (cancelled || !video || video.readyState < 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!pausedRef.current) {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          const now = Date.now();
          // Debounce the same value for 2.5s so one presentation = one check-in.
          if (value && (value !== lastValue || now - lastAt > 2500)) {
            lastValue = value;
            lastAt = now;
            onResultRef.current(value);
          }
        } catch {
          /* transient decode error — keep scanning */
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setState('scanning');
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setState((err as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (state === 'unsupported' || state === 'denied' || state === 'error') {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center ${className ?? ''}`}
      >
        <CameraOff size={32} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">
            {state === 'unsupported' ? 'Scanning not supported here' : state === 'denied' ? 'Camera permission needed' : 'Camera unavailable'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {state === 'unsupported'
              ? 'This browser has no QR scanner. Use manual check-in, or open the kiosk in Chrome/Android.'
              : state === 'denied'
                ? 'Allow camera access to scan tickets, or use manual check-in.'
                : 'Couldn’t start the camera. Use manual check-in.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black ${className ?? ''}`}>
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      {/* Reticle */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative size-52 max-w-[70%]">
          <span className="absolute left-0 top-0 size-8 rounded-tl-xl border-l-4 border-t-4 border-primary" />
          <span className="absolute right-0 top-0 size-8 rounded-tr-xl border-r-4 border-t-4 border-primary" />
          <span className="absolute bottom-0 left-0 size-8 rounded-bl-xl border-b-4 border-l-4 border-primary" />
          <span className="absolute bottom-0 right-0 size-8 rounded-br-xl border-b-4 border-r-4 border-primary" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-linear-to-t from-black/70 to-transparent py-3 text-xs font-medium text-white">
        <ScanLine size={14} className="text-primary" />
        {state === 'starting' ? 'Starting camera…' : 'Point at an attendee’s ticket QR'}
      </div>
    </div>
  );
}
