import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckIcon, PencilIcon, UsersIcon, ScanLineIcon, RepeatIcon } from 'lucide-react';
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
 * Repeat — PAUSED, and visibly so.
 *
 * The design is Apple Calendar's and it is right, so it stays on screen. What
 * is gone is the ability to act on it: picking a frequency shows an
 * in-development notice and changes nothing.
 *
 * **Why the feature was paused rather than finished.** The expansion
 * arithmetic worked, DST included. The disqualifying gaps were about a
 * programme going wrong *quietly after creation* — a series silently stopping
 * at the 104th occurrence with no top-up job, and no way to edit or cancel a
 * whole programme once one tap had created 104 rows. An attendance product
 * that loses an event is worse than one that never offered to repeat it.
 *
 * ⚠️  **docs/RECURRING-EVENTS.md** holds every edge case the next attempt has
 * to handle — clocks going back, wall times that do not exist, the fifth
 * Sunday, the horizon, series-wide edits — and the library recommendations
 * (Temporal for the time math; `rrule` only for the RFC 5545 string). Do not
 * wire this control up without working through §2 of it first.
 *
 * Keeping the list visible is deliberate: a disabled control that still shows
 * its options tells the maintainer what was intended far better than a
 * feature flag or an empty space would.
 */
export type RepeatValue = null;

const FREQUENCIES = [
  { value: 'daily' as const, label: 'Every Day' },
  { value: 'weekly' as const, label: 'Every Week' },
  { value: 'fortnightly' as const, label: 'Every 2 Weeks' },
  { value: 'monthly' as const, label: 'Every Month' },
  { value: 'yearly' as const, label: 'Every Year' },
];

export function RepeatField() {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState<string | null>(null);

  return (
    <>
      <OptionRow icon={RepeatIcon} label="Repeat" value="Never" muted onClick={() => setOpen(true)} />
      <SheetDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTouched(null);
        }}
        title="Repeat"
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={() => setOpen(false)}>
            <CheckIcon /> Done
          </Button>
        }
      >
        <div className="-mx-1 divide-y divide-border overflow-hidden rounded-2xl border border-border opacity-60">
          {[{ value: null, label: 'Never' }, ...FREQUENCIES].map((option) => {
            const selected = option.value === null;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={!selected}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
                onClick={() => setTouched(option.value === null ? null : option.label)}
              >
                <CheckIcon size={15} className={cn('shrink-0 text-primary', !selected && 'opacity-0')} />
                <span className="text-sm">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Shown on tap rather than permanently: the notice should answer the
            question the organiser just asked, not sit there as decoration. */}
        <div
          className={cn(
            'mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 ring-1 ring-warning/30 transition-opacity',
            touched ? 'opacity-100' : 'opacity-0'
          )}
          aria-live="polite"
        >
          <AlertTriangle size={14} className="mt-px shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-warning">
            <strong>Repeating events are still in development.</strong>
            <span className="mt-1 block font-normal opacity-90">
              Getting this wrong means somebody turns up and the event is not in the system, so it
              is on hold until it handles daylight saving, clocks going back, and editing a whole
              programme. For now, create each one on its own.
            </span>
          </p>
        </div>
      </SheetDialog>
    </>
  );
}
