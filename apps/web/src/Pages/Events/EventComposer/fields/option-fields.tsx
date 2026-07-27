import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckIcon, PencilIcon, UsersIcon, ScanLineIcon } from 'lucide-react';
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
