import { useState } from 'react';
import { format } from 'date-fns/format';
import { Calendar } from '@credopass/ui/components/calendar';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { TimelineMarker } from '@credopass/ui/components/timeline';
import { CalendarDays, CheckIcon, Clock } from 'lucide-react';
import { cn } from '@credopass/ui/lib/utils';

interface DateTimeFieldProps {
  label: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  /** Dot marker style: filled for the start row, hollow for the end row. */
  marker?: 'filled' | 'hollow';
  /** Rail segments joining this row's dot to its neighbours. */
  connectAbove?: boolean;
  connectBelow?: boolean;
  /** Days before this are not selectable — used to keep End at or after Start. */
  minDate?: Date;
  invalid?: boolean;
}

const applyTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
};

/** Quarter-hour slots across the day — the fast path for picking a time. */
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const minutes = (i % 4) * 15;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

type Panel = 'date' | 'time';

/**
 * A Luma-style row — label on the left, date and time chips on the right —
 * that opens a two-step popup: pick the day, then pick the time. They are
 * separate panels rather than a calendar with a time input bolted underneath,
 * so each one gets the whole sheet.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  marker = 'filled',
  connectAbove = false,
  connectBelow = false,
  minDate,
  invalid,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('date');
  // Draft state so closing without confirming leaves the value untouched.
  const [draft, setDraft] = useState<Date | undefined>(value);
  const [time, setTime] = useState(value ? format(value, 'HH:mm') : '09:00');

  // Seed the draft on open rather than in an effect — nothing external to sync.
  const openPopup = (initialPanel: Panel) => {
    setDraft(value);
    setTime(value ? format(value, 'HH:mm') : '09:00');
    setPanel(initialPanel);
    setOpen(true);
  };

  const commit = () => {
    onChange(draft ? applyTime(draft, time) : undefined);
    setOpen(false);
  };

  const reset = () => {
    setDraft(undefined);
    setTime('09:00');
  };

  return (
    <>
      <div
        className={cn(
          'flex w-full items-stretch gap-3 rounded-lg px-3 py-2.5 transition-colors',
          invalid && 'ring-1 ring-destructive/50'
        )}
      >
        {/* Bleeds through the row's vertical padding so the rail meets the
            neighbouring row's rail with no gap, whatever height the rows are. */}
        <TimelineMarker
          variant={marker}
          connectAbove={connectAbove}
          connectBelow={connectBelow}
          className="-my-2.5"
        />
        <span className="flex w-12 shrink-0 items-center text-sm text-muted-foreground">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => openPopup('date')}
            className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors hover:bg-muted"
          >
            {value ? format(value, 'EEE d MMM') : 'Set date'}
          </button>
          <button
            type="button"
            onClick={() => openPopup('time')}
            className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors hover:bg-muted"
          >
            {value ? format(value, 'HH:mm') : '--:--'}
          </button>
        </span>
      </div>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title={`${label} date & time`}
        // Roomier than the default sheet so the calendar can breathe.
        className="sm:max-w-lg"
        footerStart={
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            onClick={reset}
          >
            Reset
          </Button>
        }
        footer={
          <Button
            size="icon"
            aria-label="Confirm date and time"
            className="size-11 rounded-full"
            onClick={commit}
          >
            <CheckIcon />
          </Button>
        }
        contentClassName="flex flex-col gap-4"
      >
        {/* Step switcher — the two panels are peers, not a form and an afterthought */}
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
          {(
            [
              { key: 'date', icon: CalendarDays, label: draft ? format(draft, 'EEE d MMM') : 'Pick a date' },
              { key: 'time', icon: Clock, label: time },
            ] as const
          ).map(({ key, icon: Icon, label: chipLabel }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPanel(key)}
              className={cn(
                'flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold tabular-nums transition-colors',
                panel === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={13} />
              {chipLabel}
            </button>
          ))}
        </div>

        {panel === 'date' ? (
          // Same calendar element as the events page widget: full-width grid,
          // dropdown month/year header and large touch targets.
          <Calendar
            mode="single"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            captionLayout="dropdown"
            className="w-full rounded-2xl [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(12)]"
            classNames={{ root: 'w-full' }}
            formatters={{
              formatMonthDropdown: (date) => date.toLocaleString('default', { month: 'long' }),
            }}
            autoFocus
          />
        ) : (
          <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-4">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setTime(slot)}
                className={cn(
                  'h-10 rounded-full text-[13px] font-medium tabular-nums transition-colors',
                  slot === time
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </SheetDialog>
    </>
  );
}
