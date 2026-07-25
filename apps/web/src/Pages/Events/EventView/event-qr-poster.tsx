import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { toast } from '@credopass/ui/components/sonner';

/** Strip anything that would upset a filesystem, so the download lands cleanly. */
const fileStem = (name: string) =>
  (name.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'event') + '_qr';

const triggerDownload = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * "Poster QR" — a big scannable code for the event, downloadable as PNG or SVG
 * so an organiser can drop it into a printed flyer or a door sign.
 *
 * Both exports render from hidden off-screen QR nodes at poster resolution
 * rather than scaling up the on-screen preview, which would print blurry. They
 * are always mounted while the sheet is open (not conditionally on click) so the
 * refs are populated by the time either button is pressed.
 */
export function EventQrPoster({
  open,
  onOpenChange,
  eventName,
  shareUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  shareUrl: string;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const downloadPng = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) {
      toast.error('Could not render the QR image');
      return;
    }
    triggerDownload(canvas.toDataURL('image/png'), `${fileStem(eventName)}.png`);
    toast.success('PNG downloaded');
  };

  const downloadSvg = () => {
    const svg = svgWrapRef.current?.querySelector('svg');
    if (!svg) {
      toast.error('Could not render the QR image');
      return;
    }
    const markup = new XMLSerializer().serializeToString(svg);
    // Prepend the XML declaration so the file opens as a standalone SVG rather
    // than an inline fragment.
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${fileStem(eventName)}.svg`);
    URL.revokeObjectURL(url);
    toast.success('SVG downloaded');
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Poster QR"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={downloadSvg}>
            <Download size={14} /> SVG
          </Button>
          <Button size="sm" className="gap-1.5 rounded-full" onClick={downloadPng}>
            <Download size={14} /> PNG
          </Button>
        </div>
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="flex flex-col items-center gap-3 py-1 text-center">
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={shareUrl} size={216} level="M" marginSize={0} />
        </div>
        <p className="text-sm font-semibold">{eventName}</p>
        <p className="max-w-72 text-xs text-muted-foreground">
          Print this on a flyer or door sign — scanning it opens the event page where guests register
          and get their pass.
        </p>
      </div>

      {/* Off-screen poster-resolution sources for the two downloads. `aria-hidden`
          + no focusable content keeps them out of the accessibility tree. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 opacity-0">
        <div ref={canvasWrapRef}>
          <QRCodeCanvas value={shareUrl} size={1024} level="M" marginSize={4} />
        </div>
        <div ref={svgWrapRef}>
          <QRCodeSVG value={shareUrl} size={1024} level="M" marginSize={4} />
        </div>
      </div>
    </SheetDialog>
  );
}

/** The pill that opens the poster sheet — pairs with `EventQrPoster`. */
export function EventQrPosterButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onClick}>
      <QrCode size={14} /> Poster QR
    </Button>
  );
}

/** Convenience hook so callers don't repeat the open/close state. */
export function useEventQrPoster() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, openPoster: () => setOpen(true) };
}
