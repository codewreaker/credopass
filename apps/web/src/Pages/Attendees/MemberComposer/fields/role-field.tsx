import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { cn } from '@credopass/ui/lib/utils';
import type { EventRole } from '@credopass/lib/schemas';
import { ROLE_OPTIONS } from '../use-member-form';

interface RoleFieldProps {
  value: EventRole;
  onChange: (role: EventRole) => void;
}

/** Which hat this person wears on the event they are being added to. */
export function RoleField({ value, onChange }: RoleFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = ROLE_OPTIONS.find((option) => option.value === value) ?? ROLE_OPTIONS[2];

  const select = (role: EventRole) => {
    onChange(role);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <ShieldCheck size={16} className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Role
          </span>
          <span className="truncate text-sm font-medium">{selected.label}</span>
        </span>
        <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
          {selected.description}
        </span>
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Role on this event"
        contentClassName="flex flex-col gap-1.5"
      >
        {ROLE_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => select(option.value)}
              className={cn(
                'flex flex-col gap-0.5 rounded-2xl border px-4 py-3 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <span className={cn('text-sm font-semibold', active && 'text-primary')}>
                {option.label}
              </span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </SheetDialog>
    </>
  );
}
