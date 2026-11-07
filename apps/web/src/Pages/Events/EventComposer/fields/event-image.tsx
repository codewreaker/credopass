import { useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Link2, Trash2, X } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { cn } from '@credopass/ui/lib/utils';

/** The default event cover — a friendly illustration, Luma-style. */
export const DEFAULT_EVENT_IMAGE = '/calendar-bro.svg';

interface EventImageProps {
  /** Current image: an https URL, an object URL, or undefined for the default. */
  src?: string;
  /**
   * When provided the image is editable. Reports back an image to show, or
   * `null` to go back to the default. Omit for read-only.
   */
  onPick?: (url: string | null) => void;
  /**
   * Does the current `src` actually survive a save?
   *
   * A pasted https link does. A file still does not — there is nowhere to put
   * the bytes until object storage lands (ROADMAP stage 4) — and the component
   * says so rather than letting someone pick a photo, press Save and quietly
   * get the illustration back.
   */
  willPersist?: boolean;
  className?: string;
}

/** Is this something we can safely hand to an `<img src>` on a public page? */
const isUsableImageUrl = (value: string): boolean => {
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * The event poster, with a picker.
 *
 * This slot has existed since the composer was written and persisted nothing:
 * it held a blob URL in React state and dropped it on submit, so no event in
 * the product has ever had an image (`TODO(event-image)`).
 *
 * **Pasting a link now works end to end** (F14). `events.cover_image_url` holds
 * an absolute https URL, and it is rendered wherever an event appears —
 * including the public page and the pass, which is what makes an invitation QR
 * read as a flyer rather than a naked code (F9).
 *
 * Uploads are still preview-only. That is stage 4 — a bucket, presigned PUTs,
 * compression and derivatives — and the point of shipping the paste path first
 * is that the slot stops being decorative a week earlier.
 */
export function EventImage({ src, onPick, willPersist = true, className }: EventImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');

  const isDefault = !src;
  const shown = src || DEFAULT_EVENT_IMAGE;

  // A remote poster can 404, or be a link to something that is not an image at
  // all. Fall back to the illustration rather than leaving a broken-image icon
  // sitting in the middle of the composer.
  //
  // The failure is remembered as the URL that failed, not as a boolean reset by
  // an effect: a new `src` is simply a different string, so it starts un-failed
  // with no effect to run and nothing to get out of step.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = !!src && failedSrc === src;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    onPick?.(URL.createObjectURL(file));
    e.target.value = '';
  };

  const applyLink = () => {
    const trimmed = linkDraft.trim();
    if (!isUsableImageUrl(trimmed)) return;
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    onPick?.(trimmed);
    setLinkDraft('');
    setLinkOpen(false);
  };

  const clear = () => {
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    onPick?.(null);
  };

  const linkValid = isUsableImageUrl(linkDraft);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted/30">
        <img
          src={broken ? DEFAULT_EVENT_IMAGE : shown}
          alt=""
          aria-hidden
          onError={() => setFailedSrc(shown)}
          className={cn(
            'block h-40 w-full sm:h-48 md:h-56',
            isDefault || broken ? 'object-contain p-4' : 'object-cover'
          )}
        />

        {/*
          F15. The first person to use this slot picked a file, saved, and the
          image was gone — because an upload has nowhere to be stored until
          object storage lands (ROADMAP stage 4). That was already "said", in
          muted 11px text underneath, and it was read straight past.

          So the warning now sits ON the image, in warning colour, at the
          moment the preview appears. Nobody should be able to pick a file and
          be surprised later.
        */}
        {onPick && !willPersist && !broken && (
          <div className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-xl bg-warning/15 px-3 py-2 text-left ring-1 ring-warning/40 backdrop-blur-sm">
            <AlertTriangle size={14} className="mt-px shrink-0 text-warning" />
            <p className="text-[11px] font-semibold leading-tight text-warning">
              Preview only — this photo will not be saved yet.
              <span className="block font-normal opacity-90">
                Use Paste link to set a poster that sticks.
              </span>
            </p>
          </div>
        )}

        {onPick && (
          <>
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              {!isDefault && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Remove the poster"
                  title="Remove the poster"
                  className="inline-flex items-center justify-center rounded-full bg-background/85 p-2 shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background"
              >
                <Link2 size={13} />
                Paste link
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background"
              >
                <ImagePlus size={13} />
                {isDefault ? 'Add photo' : 'Change'}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </>
        )}
      </div>

      {onPick && linkOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <Input
            autoFocus
            value={linkDraft}
            placeholder="https://…/poster.jpg"
            className="h-9 rounded-lg"
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
          />
          <Button
            type="button"
            size="sm"
            className="shrink-0 rounded-lg"
            disabled={!linkValid}
            onClick={applyLink}
          >
            Use
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Cancel"
            className="shrink-0"
            onClick={() => setLinkOpen(false)}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Say which of the two paths actually sticks. Letting someone pick a
          photo and silently discarding it is the defect this replaces. */}
      {onPick && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {broken
            ? 'That link did not load an image — check it, or paste another.'
            : willPersist
              ? 'Paste an image link to set a poster. Uploads arrive with poster storage.'
              : 'Uploads arrive with poster storage.'}
        </p>
      )}
    </div>
  );
}
