import { useState, type ComponentType } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { cn } from '@credopass/ui/lib/utils';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ComponentType<{ size?: number; className?: string }>;
  placeholder?: string;
  /** Shown under the label when the field is empty. */
  hint?: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel';
  optional?: boolean;
  invalid?: boolean;
  error?: string;
}

/**
 * One row, one value. Tapping it opens a SheetDialog holding a single input —
 * the same granular pattern the event composer uses, and the reason full forms
 * are pages rather than dialogs.
 */
export function TextField({
  label,
  value,
  onChange,
  icon: Icon,
  placeholder,
  hint,
  type = 'text',
  inputMode,
  optional,
  invalid,
  error,
}: TextFieldProps) {
  const [open, setOpen] = useState(false);
  // Draft state so closing without confirming leaves the value untouched.
  const [draft, setDraft] = useState(value);

  const openPopup = () => {
    setDraft(value);
    setOpen(true);
  };

  const commit = () => {
    onChange(draft.trim());
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40',
          invalid && 'bg-destructive/5'
        )}
      >
        <Icon size={16} className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
            {optional && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
          </span>
          <span className={cn('truncate text-sm font-medium', !value && 'text-muted-foreground')}>
            {value || hint || `Add ${label.toLowerCase()}`}
          </span>
        </span>
        {invalid && error && (
          <span className="ml-auto shrink-0 text-[11px] font-medium text-destructive">Fix</span>
        )}
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={commit}>
            <CheckIcon /> Done
          </Button>
        }
        contentClassName="flex flex-col gap-2"
      >
        <Input
          autoFocus
          type={type}
          inputMode={inputMode}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          className="h-11 rounded-full px-4"
        />
        {error && <p className="px-1 text-xs text-destructive">{error}</p>}
      </SheetDialog>
    </>
  );
}
