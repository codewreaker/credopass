'use client';

import * as React from 'react';
import { Sparkles, ArrowUpRight, Crown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface UpgradeCTAProps {
  /** sm = compact pill (toolbars), md = standard pill (page headers), lg = full-width banner */
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  /** lg only — headline + supporting copy */
  title?: string;
  description?: string;
  label?: string;
}

/** Animated sheen swept across the button on hover (and slowly on lg). */
const Sheen = ({ always = false }: { always?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/40 to-transparent',
      always
        ? 'animate-[upgrade-sheen_3.2s_ease-in-out_infinite]'
        : 'transition-transform duration-700 group-hover/upgrade:translate-x-full'
    )}
  />
);

/**
 * UpgradeCTA — the "go Pro" moment, in three sizes.
 * Lime gradient pill with a glow and a light sheen sweep; the lg variant is a
 * full-width banner card for high-intent surfaces.
 */
export const UpgradeCTA: React.FC<UpgradeCTAProps> = ({
  size = 'md',
  onClick,
  className,
  title = 'Go Pro',
  description = 'Unlock advanced analytics, unlimited events and priority support.',
  label = 'Upgrade',
}) => {
  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group/upgrade relative w-full overflow-hidden rounded-2xl bg-primary text-primary-foreground text-left cursor-pointer',
          'p-4 sm:p-5 flex items-center gap-4 transition-all duration-200',
          'shadow-[0_0_28px_-6px] shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]',
          className
        )}
      >
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-[12px] border-primary-foreground/8" />
        <Sheen always />
        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground text-primary">
          <Crown size={18} />
        </span>
        <span className="relative z-10 min-w-0 flex-1">
          <span className="block text-[15px] font-bold tracking-tight">{title}</span>
          <span className="block text-xs font-medium text-primary-foreground/70 mt-0.5 truncate">{description}</span>
        </span>
        <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 transition-transform duration-200 group-hover/upgrade:translate-x-0.5 group-hover/upgrade:-translate-y-0.5">
          <ArrowUpRight size={15} />
        </span>
      </button>
    );
  }

  const compact = size === 'sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group/upgrade relative inline-flex items-center overflow-hidden rounded-full bg-primary text-primary-foreground font-semibold cursor-pointer whitespace-nowrap',
        'shadow-[0_0_16px_-4px] shadow-primary/40 hover:shadow-primary/60 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]',
        compact ? 'h-8 gap-1.5 px-3 text-xs' : 'h-10 gap-2 px-5 text-sm',
        className
      )}
    >
      <Sheen />
      <Sparkles size={compact ? 12 : 14} className="relative z-10" />
      <span className="relative z-10">{label}</span>
    </button>
  );
};

export default UpgradeCTA;
