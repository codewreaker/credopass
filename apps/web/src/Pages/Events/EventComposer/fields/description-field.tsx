import { useState } from 'react';
import { CheckIcon, FileText } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Textarea } from '@credopass/ui/components/textarea';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { cn } from '@credopass/ui/lib/utils';

const MAX_LENGTH = 500;

interface DescriptionFieldProps {
  value: string;
  onChange: (description: string) => void;
}

export function DescriptionField({ value, onChange }: DescriptionFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Seed the draft on open rather than in an effect — nothing external to sync.
  const openPopup = () => {
    setDraft(value);
    setOpen(true);
  };

  const commit = () => {
    onChange(draft.slice(0, MAX_LENGTH));
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <FileText size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className={cn('text-sm line-clamp-2 min-w-0', !value && 'text-muted-foreground')}>
          {value || 'Add Description'}
        </span>
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Event Description"
        footerStart={
          <span className="text-xs tabular-nums text-muted-foreground">
            {draft.length}/{MAX_LENGTH}
          </span>
        }
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={commit}>
            <CheckIcon /> Done
          </Button>
        }
      >
        <Textarea
          // The textarea mounts with the popup, so autoFocus opens the keyboard
          // — which is exactly the resize SheetDialog is listening for.
          autoFocus
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Who should come? What's the event about?"
          className="min-h-40 resize-none rounded-xl border-transparent bg-muted/40 text-base"
        />
      </SheetDialog>
    </>
  );
}
