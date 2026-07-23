import { useState } from 'react';
import { format } from 'date-fns/format';
import { Calendar } from '@credopass/ui/components/calendar';
import { Input } from '@credopass/ui/components/input';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { CheckIcon } from 'lucide-react';
import { cn } from '@credopass/ui/lib/utils';

interface DateTimeFieldProps {
  label: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  /** Dot marker style: filled for the start row, hollow for the end row. */
  marker?: 'filled' | 'hollow';
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

/**
 * A Luma-style row — label on the left, date and time chips on the right —
 * that opens a calendar in a granular popup rather than editing inline.
 */
export function DateTimeField({ label, value, onChange, marker = 'filled', minDate, invalid }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  // Draft state so closing without confirming leaves the value untouched.
  const [draft, setDraft] = useState<Date | undefined>(value);
  const [time, setTime] = useState(value ? format(value, 'HH:mm') : '09:00');

  // Seed the draft on open rather than in an effect — nothing external to sync.
  const openPopup = () => {
    setDraft(value);
    setTime(value ? format(value, 'HH:mm') : '09:00');
    setOpen(true);
  };

  const commit = () => {
    onChange(draft ? applyTime(draft, time) : undefined);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 rounded-lg',
          invalid && 'ring-1 ring-destructive/50'
        )}
      >
        <span
          className={cn(
            'size-2 rounded-full shrink-0',
            marker === 'filled' ? 'bg-primary' : 'border-2 border-muted-foreground bg-transparent'
          )}
        />
        <span className="text-sm text-muted-foreground w-12 shrink-0">{label}</span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium tabular-nums">
            {value ? format(value, 'EEE d MMM') : 'Set date'}
          </span>
          <span className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm font-medium tabular-nums">
            {value ? format(value, 'HH:mm') : '--:--'}
          </span>
        </span>
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title={`${label} date & time`}
        footerStart={
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setDraft(undefined)}>
            Reset
          </Button>
        }
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={commit}>
            <CheckIcon /> Done
          </Button>
        }
        contentClassName="flex flex-col items-center gap-3"
      >
        <Calendar
          mode="single"
          selected={draft}
          onSelect={setDraft}
          defaultMonth={draft ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          autoFocus
        />
        <div className="flex w-full items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Time</span>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-32 rounded-lg tabular-nums"
          />
        </div>
      </SheetDialog>
    </>
  );
}
