import * as React from 'react';
import { cn } from '../lib/utils';

export interface DecorMaskProps {
  /** URL of the SVG/image to use as the alpha mask. */
  src: string;
  /** show item or just mask */
  content?: boolean;
  /**
   * Tailwind classes controlling the fill color (e.g. `bg-primary/10`),
   * size and position of the silhouette. Positioned absolute by default.
   */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * DecorMask — renders an SVG (or any image) as a translucent single-color
 * silhouette using CSS masking. Used for the decorative artwork on the auth
 * billboards, the same way the ring circles are used elsewhere.
 */
export const DecorMask: React.FC<DecorMaskProps> = ({ src, className, style, content }) => (
  <div
    aria-hidden
    className={cn('pointer-events-none absolute', className)}
    style={{
      ...(content && {content: `url(${src})`}),
      WebkitMaskImage: `url(${src})`,
      maskImage: `url(${src})`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      ...style,
    }}
  />
);

export default DecorMask;
