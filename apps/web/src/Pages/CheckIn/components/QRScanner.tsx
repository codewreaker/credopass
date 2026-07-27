import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { CameraOff, ScanLine, UserRoundPlus } from 'lucide-react';

interface QRScannerProps {
  /** Fires with the decoded QR text; deduped so a held code fires once. */
  onResult: (value: string) => void;
  /** Paused while a success screen is up, so we don't re-fire mid-celebration. */
  paused?: boolean;
  /** Surfaces raw decode failures to the DEV drawer for debugging. */
  onDecodeError?: (message: string) => void;
  /** Inline escape hatch when the camera can't start — jump to manual check-in. */
  onUseManual?: () => void;
  className?: string;
}

type ScannerState = 'starting' | 'scanning' | 'denied' | 'error';

/**
 * Camera QR scanner built on `html5-qrcode`.
 *
 * We moved off the native BarcodeDetector because it isn't supported in mobile
 * Chrome (and Safari). html5-qrcode is a battle-tested camera scanner with broad
 * mobile support. It injects its own <video> into a host element by id.
 */
export function QRScanner({ onResult, paused = false, onDecodeError, onUseManual, className }: QRScannerProps) {
  const [state, setState] = useState<ScannerState>('starting');
  // Stable, render-safe host id for html5-qrcode to mount its video into.
  const containerId = `qr-scanner-${useId().replace(/:/g, '')}`;

  // Ref mirrors so the scan loop reads the latest without restarting.
  const pausedRef = useRef(paused);
  const onResultRef = useRef(onResult);
  const onDecodeErrorRef = useRef(onDecodeError);
  useEffect(() => {
    pausedRef.current = paused;
    onResultRef.current = onResult;
    onDecodeErrorRef.current = onDecodeError;
  });

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId, /* verbose */ false);
    let stopped = false;
    let lastValue = '';
    let lastAt = 0;

    const started = scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (vw: number, vh: number) => {
            // html5-qrcode THROWS on a box under 50px, and it calls this with
            // the video element's real dimensions — which are 0 for the frame
            // or two before the stream attaches. Without the floor, mounting
            // the scanner on a not-yet-laid-out container kills the render.
            const side = Math.max(50, Math.floor(Math.min(vw, vh) * 0.7));
            return { width: side, height: side };
          },
        },
        (decodedText) => {
          if (pausedRef.current) return;
          const now = Date.now();
          // Debounce the same value for 2.5s so one presentation = one check-in.
          if (decodedText && (decodedText !== lastValue || now - lastAt > 2500)) {
            lastValue = decodedText;
            lastAt = now;
            onResultRef.current(decodedText);
          }
        },
        (errorMessage) => {
          // Per-frame "no code found" is normal noise; forward to DEV only.
          onDecodeErrorRef.current?.(errorMessage);
        }
      )
      .then(() => {
        if (!stopped) setState('scanning');
      })
      .catch((err: unknown) => {
        const name = (err as { name?: string })?.name ?? String(err);
        setState(name.includes('NotAllowed') || name.includes('Permission') ? 'denied' : 'error');
      });

    return () => {
      stopped = true;
      // Two traps here, and the old one-liner fell into both.
      //
      // 1. `stop()` THROWS synchronously — it does not reject — when the
      //    scanner isn't running ("Cannot stop, scanner is not running or
      //    paused."). A trailing `.catch()` never sees that, so it escaped to
      //    the error boundary and took the page down.
      // 2. Cleanup routinely lands while `start()` is still in flight: React
      //    runs effects twice in StrictMode, and switching to the scanner tab
      //    mounts and unmounts faster than the camera comes up. So we wait for
      //    start to settle before deciding whether there is anything to stop.
      void started
        .catch(() => {})
        .then(() => {
          try {
            if (scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) {
              scanner.clear();
              return;
            }
            return scanner
              .stop()
              .then(() => scanner.clear())
              .catch(() => {});
          } catch {
            // Raced anyway — the camera is already down, nothing to release.
          }
        });
    };
  }, [containerId]);

  const errored = state === 'denied' || state === 'error';

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black ${className ?? ''}`}>
      {/* html5-qrcode mounts its <video> here */}
      <div id={containerId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

      {errored ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-8 text-center">
          <CameraOff size={32} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">
              {state === 'denied' ? 'Camera permission needed' : 'Camera unavailable'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {state === 'denied'
                ? 'Allow camera access in your browser to scan tickets, or check people in by name instead.'
                : 'We couldn’t start the camera on this device. You can still check people in by name.'}
            </p>
          </div>
          {onUseManual && (
            <button
              type="button"
              onClick={onUseManual}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserRoundPlus size={15} />
              Manual check-in
            </button>
          )}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-linear-to-t from-black/70 to-transparent py-3 text-xs font-medium text-white">
          <ScanLine size={14} className="text-primary" />
          {state === 'starting' ? 'Starting camera…' : 'Point at an attendee’s ticket QR'}
        </div>
      )}
    </div>
  );
}
