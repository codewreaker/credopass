import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckIcon, PencilIcon, UsersIcon, ScanLineIcon, RepeatIcon } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { cn } from '@credopass/ui/lib/utils';

/** One row of the "Event Options" list — icon, label, current value, edit affordance. */
function OptionRow({
  icon: Icon,
  label,
  value,
  onClick,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <span className="text-sm">{label}</span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        <span className={cn('text-sm', muted ? 'text-muted-foreground' : 'font-medium')}>{value}</span>
        <PencilIcon size={13} className="text-muted-foreground" />
      </span>
    </button>
  );
}

export function CapacityField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (capacity: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Seed the draft on open rather than in an effect — nothing external to sync.
  const openPopup = () => {
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      <OptionRow
        icon={UsersIcon}
        label="Capacity"
        value={value ? `${value} guests` : 'Unlimited'}
        muted={!value || Boolean(invalid)}
        onClick={openPopup}
      />
      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Capacity"
        footerStart={
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setDraft('')}>
            Unlimited
          </Button>
        }
        footer={
          <Button
            size="sm"
            className="rounded-full px-4"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            <CheckIcon /> Done
          </Button>
        }
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Max attendees"
          className="h-12 rounded-xl border-transparent bg-muted/40 px-4 text-base"
        />
        <p className="mt-2 text-xs text-muted-foreground">Leave blank for unlimited capacity.</p>
      </SheetDialog>
    </>
  );
}

/**
 * Self check-in toggle. Unlike the other option rows this edits a single boolean,
 * so it flips in place rather than opening a SheetDialog.
 */
export function SelfCheckInField({ value, onChange }: { value: boolean; onChange: (allow: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <ScanLineIcon size={16} className="shrink-0 text-muted-foreground" />
      <span className="flex flex-col">
        <span className="text-sm">Self check-in</span>
        <span className="text-xs text-muted-foreground">
          {value ? 'Attendees can check themselves in' : 'Staff must scan or check in each attendee'}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'ml-auto flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          value ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-background shadow-sm transition-transform',
            value && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}

/**
 * Repeat — turn a one-off into a recurring programme (F5, D40).
 *
 * **Modelled on Apple Calendar**, because it is the repeat picker nearly
 * everyone has already used: a plain checkmark list of frequencies, then an
 * end date once a frequency is chosen. No pill grids, no counts to translate.
 *
 * **An end DATE, not a number of occurrences.** "Until the end of term" is a
 * question an organiser can answer; "how many Sundays is that" is arithmetic
 * they should not have to do. The server turns the date into rows and caps
 * the total, and this sheet says so when the cap bites.
 *
 * **Create only.** The row is hidden when editing, because changing the
 * pattern of an existing programme is a different question with a different
 * answer: the occurrences are already real rows, some with people registered
 * against them, and "make it fortnightly instead" would have to decide what
 * happens to those. That is its own piece of work; offering the control
 * without it would be a lie.
 */
export type RepeatValue = {
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
  /** Inclusive end date, as an instant. */
  until: Date;
} | null;

const FREQUENCIES = [
  { value: 'daily' as const, label: 'Every Day' },
  { value: 'weekly' as const, label: 'Every Week' },
  { value: 'fortnightly' as const, label: 'Every 2 Weeks' },
  { value: 'monthly' as const, label: 'Every Month' },
  { value: 'yearly' as const, label: 'Every Year' },
];

/** Server-side horizon. Mirrored here only to warn before submitting. */
const MAX_OCCURRENCES = 104;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A sensible first end date per frequency — roughly a season of each. */
const defaultUntil = (frequency: NonNullable<RepeatValue>['frequency'], from: Date): Date => {
  const d = new Date(from);
  switch (frequency) {
    case 'daily':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 5);
      break;
    default:
      d.setMonth(d.getMonth() + 3);
  }
  return d;
};

/**
 * A `Date` we can safely call methods on.
 *
 * The form state round-trips through a zod validator and an error boundary,
 * and a `Date` that has been through either can come back as an ISO string or
 * as undefined. `estimate` crashed on exactly that — `until.getTime()` on a
 * value that was no longer a Date — which took the whole composer down via
 * the error boundary. Normalising on read is cheaper than trusting the type.
 */
const asDate = (value: unknown, fallback: Date): Date => {
  const d = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
};

/** How many events this will actually create — the same arithmetic the server does. */
const estimate = (frequency: NonNullable<RepeatValue>['frequency'], start: Date, until: Date): number => {
  const span = Math.max(0, until.getTime() - start.getTime());
  const step =
    frequency === 'daily' ? DAY_MS
    : frequency === 'weekly' ? 7 * DAY_MS
    : frequency === 'fortnightly' ? 14 * DAY_MS
    : frequency === 'monthly' ? 30.44 * DAY_MS
    : 365.25 * DAY_MS;
  return Math.min(MAX_OCCURRENCES, Math.floor(span / step) + 1);
};

const asDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function RepeatField({
  value,
  onChange,
  startAt,
}: {
  value: RepeatValue;
  onChange: (v: RepeatValue) => void;
  /** The event's start — the end date cannot precede it, and seeds the default. */
  startAt?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RepeatValue>(value);

  const openPopup = () => {
    setDraft(value);
    setOpen(true);
  };

  const from = asDate(startAt, new Date());
  const summary = value ? FREQUENCIES.find((f) => f.value === value.frequency)?.label ?? 'Never' : 'Never';
  // Normalised here, once, so every read below is a real Date.
  const draftUntil = draft ? asDate(draft.until, defaultUntil(draft.frequency, from)) : null;
  const count = draft && draftUntil ? estimate(draft.frequency, from, draftUntil) : 0;

  return (
    <>
      <OptionRow icon={RepeatIcon} label="Repeat" value={summary} muted={!value} onClick={openPopup} />
      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Repeat"
        footer={
          <Button
            size="sm"
            className="rounded-full px-4"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            <CheckIcon /> Done
          </Button>
        }
      >
        {/* A checkmark list, exactly as Apple's. "Never" is a row in it, not a
            separate control, so choosing it is the same gesture as choosing
            anything else. */}
        <div className="-mx-1 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {[{ value: null, label: 'Never' }, ...FREQUENCIES].map((option) => {
            const selected = option.value === null ? draft === null : draft?.frequency === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                onClick={() =>
                  setDraft(
                    option.value === null
                      ? null
                      : {
                          frequency: option.value,
                          until: draftUntil ?? defaultUntil(option.value, from),
                        }
                  )
                }
              >
                <CheckIcon
                  size={15}
                  className={cn('shrink-0 text-primary', !selected && 'opacity-0')}
                />
                <span className="text-sm">{option.label}</span>
              </button>
            );
          })}
        </div>

        {draft && draftUntil && (
          <div className="mt-4">
            <label className="flex items-center gap-3 rounded-2xl border border-border px-3.5 py-3">
              <span className="text-sm">End repeat</span>
              <input
                type="date"
                className="ml-auto rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm"
                value={asDateInput(draftUntil)}
                min={asDateInput(from)}
                onChange={(e) => {
                  const picked = e.target.valueAsDate ?? new Date(e.target.value);
                  if (!Number.isNaN(picked.getTime())) setDraft({ ...draft, until: picked });
                }}
              />
            </label>

            {/* Say what the button is about to do. Each occurrence is a real
                event with its own check-in code, not a rule expanded later,
                so the number is a number of rows. */}
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Creates about {count} event{count === 1 ? '' : 's'}, starting with this one. Each has
              its own check-in code and attendance list, and you can edit or cancel any of them on
              its own.
            </p>
            {count >= MAX_OCCURRENCES && (
              <p className="mt-2 px-1 text-xs text-warning">
                That is the most we create at once ({MAX_OCCURRENCES}). Pick an earlier end date,
                or make another programme when this one runs out.
              </p>
            )}
            {draft.frequency === 'monthly' && (
              <p className="mt-2 px-1 text-xs text-muted-foreground">
                Monthly keeps the same weekday — the second Sunday, not the 8th.
              </p>
            )}
          </div>
        )}
      </SheetDialog>
    </>
  );
}
