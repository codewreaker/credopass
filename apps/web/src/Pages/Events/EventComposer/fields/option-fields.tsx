import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckIcon, PencilIcon, UsersIcon, ActivityIcon } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { cn } from '@credopass/ui/lib/utils';
import type { EventStatus } from '@credopass/lib/schemas';
import { STATUS_OPTIONS } from '../use-event-form';

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

export function StatusField({ value, onChange }: { value: EventStatus; onChange: (status: EventStatus) => void }) {
  const [open, setOpen] = useState(false);
  const current = STATUS_OPTIONS.find((option) => option.value === value);

  return (
    <>
      <OptionRow icon={ActivityIcon} label="Status" value={current?.label ?? 'Scheduled'} onClick={() => setOpen(true)} />
      <SheetDialog open={open} onOpenChange={setOpen} title="Event Status" contentClassName="px-2 pb-3">
        <div className="flex flex-col">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-muted/50"
            >
              {option.label}
              {option.value === value && <CheckIcon size={16} className="text-primary" />}
            </button>
          ))}
        </div>
      </SheetDialog>
    </>
  );
}
