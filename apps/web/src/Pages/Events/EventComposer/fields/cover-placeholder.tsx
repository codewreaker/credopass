import { cn } from '@credopass/ui/lib/utils';

/**
 * The default cover art for the composer.
 *
 * Presentation only — `events` has no cover column, so this deliberately offers
 * no upload affordance and carries no click target. It is a self-contained
 * inline SVG (no remote asset) that reuses the concentric-arc motif from the
 * lime billboard heroes, so the composer opens looking finished rather than
 * starting on an empty rectangle.
 */
export function CoverPlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-border bg-card',
        className
      )}
    >
      <svg
        viewBox="0 0 640 260"
        preserveAspectRatio="xMidYMid slice"
        className="block h-32 w-full sm:h-40 md:h-48"
        role="presentation"
      >
        <defs>
          <linearGradient id="cover-wash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cover-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--card)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--card)" stopOpacity="0.9" />
          </linearGradient>
          <pattern id="cover-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
          </pattern>
        </defs>

        <rect width="640" height="260" fill="url(#cover-grid)" />
        <rect width="640" height="260" fill="url(#cover-wash)" />

        {/* Concentric arcs — the same motif the lime hero cards use */}
        <g fill="none" stroke="var(--primary)" strokeOpacity="0.35">
          <circle cx="516" cy="52" r="58" strokeWidth="18" strokeOpacity="0.10" />
          <circle cx="516" cy="52" r="96" strokeWidth="1.5" />
          <circle cx="516" cy="52" r="134" strokeWidth="1.5" strokeOpacity="0.18" />
        </g>

        {/* Ticket stub silhouette */}
        <g transform="translate(56 74)">
          <rect
            width="176"
            height="112"
            rx="18"
            fill="var(--primary)"
            fillOpacity="0.14"
            stroke="var(--primary)"
            strokeOpacity="0.4"
            strokeWidth="1.5"
          />
          <path
            d="M118 0v112"
            stroke="var(--primary)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 7"
          />
          <circle cx="118" cy="0" r="9" fill="var(--card)" />
          <circle cx="118" cy="112" r="9" fill="var(--card)" />
          <rect x="24" y="32" width="66" height="9" rx="4.5" fill="var(--primary)" fillOpacity="0.55" />
          <rect x="24" y="52" width="46" height="8" rx="4" fill="var(--primary)" fillOpacity="0.3" />
          <g stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round">
            <path d="M136 34v44M145 34v44M154 34v30M163 34v44" />
          </g>
        </g>

        <rect width="640" height="260" fill="url(#cover-fade)" />
      </svg>
    </div>
  );
}
