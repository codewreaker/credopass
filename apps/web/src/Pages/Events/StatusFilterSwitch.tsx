import { CalendarClock, History } from 'lucide-react';
import type { EventStatusGroup } from '@credopass/lib/hooks';
import { cn } from '@credopass/ui/lib/utils';

interface StatusFilterSwitchProps {
  activeGroup: EventStatusGroup;
  onGroupChange: (group: EventStatusGroup) => void;
  /** `/events/summary`. `null` while it is in flight — never render a zero you do not have. */
  counts: { upcoming: number; past: number } | null;
  /** How many events are running right now. Shown as its own chip, not folded into a count. */
  ongoing: number;
  className?: string;
}

const GROUPS: {
  value: EventStatusGroup;
  label: string;
  icon: typeof CalendarClock;
  count: (c: { upcoming: number; past: number }) => number;
}[] = [
  { value: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: (c) => c.upcoming },
  { value: 'past', label: 'Past', icon: History, count: (c) => c.past },
];

/**
 * The events list filter: a two-position Upcoming ⇄ Past slider (exactly one
 * active — no "All", no snap-back) with each side carrying its own count.
 *
 * **The counts live here now (F3).** There used to be a summary line above this
 * reading "2 events · 1 upcoming · 0 live now", which said the same thing as
 * the switch directly beneath it. One control, one place to read the numbers.
 *
 * **The timezone toggle is gone (F4, D42).** Timezone is always displayed — it
 * is information, not a filter, and making it optional only ever hid something
 * people needed.
 *
 * A count of `null` means the summary has not arrived. It renders as a dash
 * rather than a zero: `0 events` while loading is the most repeated defect in
 * this product (UI-REDESIGN R2) and this is one of the three places it showed.
 */
export function StatusFilterSwitch({
  activeGroup,
  onGroupChange,
  counts,
  ongoing,
  className,
}: StatusFilterSwitchProps) {
  const activeIndex = GROUPS.findIndex((g) => g.value === activeGroup);

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      {/* Segmented slider. Equal-width columns (grid) so the thumb lines up with
          the labels — content-sized buttons let 'Upcoming' spill past the thumb.

          `shrink-0` is load-bearing: the header's control row is a horizontal
          scroller, and without it flex squeezed this grid to nothing — the two
          labels overlapped into "comPast" with the thumb collapsed to a dot. */}
      <div
        role="radiogroup"
        aria-label="Filter events by timing"
        className="relative grid shrink-0 grid-cols-2 rounded-full border border-border bg-card p-1"
      >
        {/* Sliding thumb — half the inner width, translated by its own width. */}
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {GROUPS.map(({ value, label, icon: Icon, count }) => {
          const active = value === activeGroup;
          const n = counts ? count(counts) : null;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={n === null ? label : `${label}, ${n} events`}
              onClick={() => onGroupChange(value)}
              className={cn(
                'relative z-10 inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-colors duration-150',
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={12} />
              {label}
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
                )}
              >
                {n === null ? '–' : n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live. Its own chip because it is the only number here that is urgent —
          an event running right now is the reason someone opened the app. Absent
          entirely when nothing is live, rather than rendering a zero. */}
      {ongoing > 0 && (
        <span
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 text-[11px] font-semibold text-success"
          title={`${ongoing} event${ongoing === 1 ? '' : 's'} happening now`}
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          {ongoing} live
        </span>
      )}
    </div>
  );
}
