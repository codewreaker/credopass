'use client';

import { FC } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { cn } from '../../lib/utils';
import './glowing-qr-code.css';

/**
 * What this code IS, which decides how it looks.
 *
 * CredoPass shows two completely different things as a QR square and, until
 * 2026-11-07, drew them identically (F6/F8/F9):
 *
 * - **`pass`** — one person's ticket. `/p/$token`. The door scans it, and it
 *   is the only copy that person has.
 * - **`invitation`** — the event's share link, `/e/{id}`. One code, printed on
 *   a poster, scanned by everyone. It is NOT a pass and the kiosk's scanner
 *   correctly refuses it.
 *
 * They cannot be merged: a code everybody shares cannot identify one person.
 * So the requirement is that they are never mistaken for one another — which
 * is a visual problem, and this prop is the fix.
 *
 * An `invitation` gets a rotating ring in `--info` (blue) on a dark pane. The
 * colour is the whole point: a lime ring on a lime-branded product reads as
 * "ours", not as "different", and the two codes have to be told apart at a
 * glance. Blue is the palette's existing cool accent and sits at hue 240
 * against lime's 121 — about as far apart as the palette goes — so it also
 * survives being photographed and being seen by someone who is not looking
 * for it.
 *
 * A `pass` stays the plain high-contrast square it has always been.
 */
export type QRCodeKind = 'pass' | 'invitation';

export interface GlowingQRCodeProps {
  /**
   * The data to encode in the QR code
   */
  value: string;
  /**
   * Size of the QR code in pixels (default: 70)
   */
  size?: number;
  /**
   * Click handler for interactive QR codes
   */
  onClick?: () => void;
  /**
   * Whether the QR code is in an expired/invalid state
   */
  expired?: boolean;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  /**
   * Accessibility label
   */
  ariaLabel?: string;
  /**
   * Show the glowing animated border (default: true)
   */
  showGlow?: boolean;
  /**
   * Background color of the inner QR code container
   */
  bgColor?: string;
  /**
   * Foreground color of the QR code
   */
  fgColor?: string;
  /**
   * Error correction level (default: H for highest)
   */
  level?: 'L' | 'M' | 'Q' | 'H';
  /**
   * Pass or invitation (default: `pass`, the historical look).
   *
   * `invitation` wraps the code in the glowing blue ring and labels it, so an
   * organiser looking at their own screen can tell at a glance that they are
   * holding the thing that gets people IN the door, not the thing that gets
   * one person THROUGH it.
   */
  kind?: QRCodeKind;
  /**
   * Caption under an `invitation` code. Defaults to "Scan to register".
   * Ignored for a `pass` — a pass is captioned by the page it lives on.
   */
  caption?: string;
}

/**
 * GlowingQRCode - A premium QR code component with animated glowing border
 *
 * Features:
 * - Animated conic gradient border
 * - Hover scale effect
 * - Customizable size and colors
 * - Click handler for fullscreen expansion
 */
export const GlowingQRCode: FC<GlowingQRCodeProps> = ({
  value,
  size = 70,
  onClick,
  expired = false,
  className,
  ariaLabel = 'QR Code',
  showGlow = true,
  bgColor = '#ffffff',
  fgColor = '#000000',
  level = 'L',
  kind = 'pass',
  caption,
}) => {
  const isInvitation = kind === 'invitation';

  /*
   * An invitation suppresses the built-in glow and shrinks its own box.
   *
   * Two bugs, one cause: the invitation ring is drawn OUTSIDE the code while
   * `.glowing-qr-border` is drawn inside, so leaving both on gave two arcs
   * spinning at once — and the inner one's 20px of breathing room is dead
   * space once it is not being drawn, which is where the extra padding came
   * from. The outer ring supplies both the effect and the spacing.
   */
  const showInnerGlow = showGlow && !isInvitation;
  const containerSize = size + (showInnerGlow ? 20 : 4);

  if (expired || !value) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-zinc-800/50',
          className
        )}
        style={{ width: containerSize, height: containerSize }}
      >
        <div className="text-zinc-500 text-xs text-center p-2">
          {expired ? 'Expired' : 'No data'}
        </div>
      </div>
    );
  }

  const content = (
    <div
      className={cn(
        'glowing-qr-container group relative',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Animated border layer */}
      {showInnerGlow && (
        <div
          className="glowing-qr-border"
          style={{ width: containerSize - 10, height: containerSize - 10}}
        />
      )}

      {/* QR Code container */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          className={cn(
            'rounded-xl transition-transform',
            isInvitation ? 'p-0' : 'p-2',
            onClick && 'group-hover:scale-[1.02]'
          )}
        >
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: bgColor }}
          >
            <QRCode
              value={value}
              size={size}
              level={level}
              bgColor={bgColor}
              fgColor={fgColor}
              marginSize={4}
              
            />
          </div>
        </div>
      </div>
    </div>
  );

  // An invitation is wrapped rather than restyled, so the code itself — the
  // part a camera reads — is byte-for-byte what it always was. The ring is
  // chrome around it and cannot affect scannability.
  const framed = isInvitation ? (
    <div className="glowing-qr-invitation">
      <div className="glowing-qr-invitation-ring">
        <div className="glowing-qr-invitation-pane">{content}</div>
      </div>
      <span className="glowing-qr-invitation-caption">{caption ?? 'Scan to register'}</span>
    </div>
  ) : (
    content
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        aria-label={ariaLabel}
      >
        {framed}
      </button>
    );
  }

  return framed;
};

export default GlowingQRCode;
