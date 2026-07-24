import { CalendarClock, History, TimerIcon } from 'lucide-react';
import type { EventStatusGroup } from '@credopass/lib/hooks';
import { cn } from '@credopass/ui/lib/utils';

interface StatusFilterSwitchProps {
  activeGroup: EventStatusGroup;
  onGroupChange: (group: EventStatusGroup) => void;
  enableTimezone: boolean;
  onToggleTimezone: () => void;
  className?: string;
}

const GROUPS: { value: EventStatusGroup; label: string; icon: typeof CalendarClock }[] = [
  { value: 'upcoming', label: 'Upcoming', icon: CalendarClock },
  { value: 'past', label: 'Past', icon: History },
];

/**
 * The events list filter: a two-position Upcoming ⇄ Past slider (exactly one
 * active — no "All", no snap-back) plus an independent Timezone toggle. A
 * sliding lime thumb sits behind whichever group is active.
 */
export function StatusFilterSwitch({
  activeGroup,
  onGroupChange,
  enableTimezone,
  onToggleTimezone,
  className,
}: StatusFilterSwitchProps) {
  const activeIndex = GROUPS.findIndex((g) => g.value === activeGroup);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Segmented slider. Equal-width columns (grid) so the thumb lines up with
          the labels — content-sized buttons let 'Upcoming' spill past the thumb. */}
      <div
        role="radiogroup"
        aria-label="Filter events by timing"
        className="relative grid grid-cols-2 rounded-full border border-border bg-card p-1"
      >
        {/* Sliding thumb — half the inner width, translated by its own width. */}
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {GROUPS.map(({ value, label, icon: Icon }) => {
          const active = value === activeGroup;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onGroupChange(value)}
              className={cn(
                'relative z-10 inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-colors duration-150',
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Timezone — independent toggle */}
      <button
        type="button"
        aria-pressed={enableTimezone}
        title="Show timezone on rows"
        onClick={onToggleTimezone}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors duration-150',
          enableTimezone
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        )}
      >
        <TimerIcon size={12} />
        <span className="hidden sm:inline">Timezone</span>
      </button>
    </div>
  );
}
