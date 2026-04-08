'use client';

import { FC } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { cn } from '../../lib/utils';
import './glowing-qr-code.css';

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
  level = 'H',
}) => {
  // Calculate container size with padding for the glow effect
  const containerSize = size + 20;

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
      {showGlow && (
        <div
          className="glowing-qr-border"
          style={{ width: containerSize + 2, height: containerSize + 2 }}
        />
      )}

      {/* QR Code container */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div
          className={cn(
            'rounded-xl p-2 transition-transform',
            onClick && 'group-hover:scale-[1.02]'
          )}
          style={{ backgroundColor: showGlow ? '#18181b' : 'transparent' }}
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
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return content;
};

export default GlowingQRCode;
