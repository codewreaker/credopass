import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Globe, Search } from 'lucide-react';
import { tzList } from '@credopass/lib/constants';
import { cn } from '@credopass/ui/lib/utils';

/** The viewer's own timezone — the default. */
export const localTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/** Components of `date` as read in `timeZone` (h23). */
export function zonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value])) as Record<string, string>;
  return { y: +p.year, mo: +p.month - 1, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

/**
 * The absolute instant for a wall-clock time (`y/mo/d h:mi`) in `timeZone`.
 * Uses the standard offset-inversion trick so we never need a tz library.
 */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const asUTC = Date.UTC(y, mo, d, h, mi, 0);
  const seen = zonedParts(new Date(asUTC), timeZone);
  const seenUTC = Date.UTC(seen.y, seen.mo, seen.d, seen.h, seen.mi, seen.s);
  return new Date(asUTC + (asUTC - seenUTC));
}

/** Short GMT offset label for a zone, e.g. "GMT+01". */
const offsetLabel = (timeZone: string): string => {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
};

const pad = (n: number) => String(n).padStart(2, '0');
const wrap = (n: number, max: number) => ((n % max) + max) % max;

/** A single stepper column (hours or minutes) with the casio-LCD digit. */
function Stepper({ value, onStep, label }: { value: number; onStep: (delta: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onStep(1)}
        className="flex size-8 items-center justify-center rounded-lg text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <ChevronUp size={18} />
      </button>
      <span className="w-[1.6em] text-center font-mono text-5xl font-bold leading-none tabular-nums text-primary [text-shadow:0_0_18px_var(--primary)]">
        {pad(value)}
      </span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onStep(-1)}
        className="flex size-8 items-center justify-center rounded-lg text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
}

interface ClockTimePickerProps {
  hour: number;
  minute: number;
  timeZone: string;
  onChange: (next: { hour: number; minute: number; timeZone: string }) => void;
}

/**
 * A digital, casio-watch-style time picker: a glowing LCD HH:MM at the centre
 * with hour/minute steppers, plus a searchable timezone selector (defaulting to
 * the viewer's own zone). Minutes step in 5s; hold-tap the digits… (steppers).
 */
export function ClockTimePicker({ hour, minute, timeZone, onChange }: ClockTimePickerProps) {
  const [tzOpen, setTzOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState('');

  const zones = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    const list = tzList as string[];
    return (q ? list.filter((z) => z.toLowerCase().includes(q)) : list).slice(0, 60);
  }, [tzQuery]);

  const set = (patch: Partial<{ hour: number; minute: number; timeZone: string }>) =>
    onChange({ hour, minute, timeZone, ...patch });

  return (
    <div className="flex flex-col gap-4">
      {/* LCD clock face */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-neutral-950 px-4 py-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />
        <div className="relative flex items-center justify-center gap-2">
          <Stepper value={hour} label="hours" onStep={(d) => set({ hour: wrap(hour + d, 24) })} />
          <span className="pb-1 font-mono text-4xl font-bold text-primary/60">:</span>
          <Stepper value={minute} label="minutes" onStep={(d) => set({ minute: wrap(minute + d * 5, 60) })} />
        </div>
        <p className="relative mt-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-primary/50">
          {offsetLabel(timeZone)} · 24h
        </p>
      </div>

      {/* Timezone selector */}
      <div className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setTzOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
        >
          <Globe size={15} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Timezone
            </span>
            <span className="block truncate text-sm font-medium">{timeZone.replace(/_/g, ' ')}</span>
          </span>
          <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {offsetLabel(timeZone)}
          </span>
          <ChevronDown size={15} className={cn('shrink-0 text-muted-foreground transition-transform', tzOpen && 'rotate-180')} />
        </button>

        {tzOpen && (
          <div className="border-t border-border p-2">
            <div className="mb-2 flex items-center gap-2 rounded-full border border-border bg-background px-3">
              <Search size={14} className="text-muted-foreground" />
              <input
                autoFocus
                value={tzQuery}
                onChange={(e) => setTzQuery(e.target.value)}
                placeholder="Search timezones…"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-56 overflow-y-auto overscroll-contain">
              <button
                type="button"
                onClick={() => {
                  set({ timeZone: localTimeZone() });
                  setTzOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted/50"
              >
                Use my timezone
                <span className="text-xs text-muted-foreground">{localTimeZone().replace(/_/g, ' ')}</span>
              </button>
              {zones.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    set({ timeZone: z });
                    setTzOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
                    z === timeZone && 'bg-primary/10 text-primary'
                  )}
                >
                  <span className="truncate">{z.replace(/_/g, ' ')}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{offsetLabel(z)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
