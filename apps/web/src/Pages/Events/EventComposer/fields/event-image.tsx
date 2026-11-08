import { useRef, useState } from 'react';
import { useUploadImage, type UploadProgress } from '@credopass/api-client';
import { AlertTriangle, Check, ImagePlus, Link2, Loader2, Trash2, Upload, X } from 'lucide-react';
import { POSTER_TEMPLATES } from '@credopass/lib/schemas/poster-templates';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { cn } from '@credopass/ui/lib/utils';

/** The default event cover — a friendly illustration, Luma-style. */
export const DEFAULT_EVENT_IMAGE = '/calendar-bro.svg';

interface EventImageProps {
  /** Current image: a stored URL, a pasted https URL, or undefined for the default. */
  src?: string;
  /**
   * When provided the image is editable. Reports back the URL to save, or
   * `null` to go back to the default. Omit for read-only.
   */
  onPick?: (url: string | null) => void;
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
export function EventImage({ src, onPick, className }: EventImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * The picker tray.
   *
   * It did not exist. "Add photo" opened a file dialog, and the only other
   * option was pasting an https URL — two things a person making an event on
   * their phone usually does not have, which is why almost no event in the
   * product had a poster. The tray leads with artwork they can just take, and
   * keeps upload and paste at the end for the people who do have their own.
   */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const upload = useUploadImage();

  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const isDefault = !src && !localPreview;
  const shown = localPreview || src || DEFAULT_EVENT_IMAGE;
  const busy = upload.isPending;

  // A remote poster can 404, or be a link to something that is not an image at
  // all. Fall back to the illustration rather than leaving a broken-image icon
  // sitting in the middle of the composer.
  //
  // The failure is remembered as the URL that failed, not as a boolean reset by
  // an effect: a new `src` is simply a different string, so it starts un-failed
  // with no effect to run and nothing to get out of step.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const broken = !!src && failedSrc === src;

  /**
   * Upload on pick, and only report a URL once the bytes are really stored.
   *
   * This used to hand back `URL.createObjectURL(file)` — a blob URL that was
   * thrown away on submit, so every photo anyone picked was silently lost
   * (F15, reported the day the slot shipped). Now the file is compressed,
   * PUT to storage, and the stored URL is what the form saves.
   *
   * A local preview is shown while that happens, so the image appears
   * immediately rather than after the round trip; it is replaced by the
   * stored URL on success and discarded on failure.
   */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);

    try {
      const asset = await upload.mutateAsync({ file, onProgress: setProgress });
      onPick?.(asset.url);
      setPickerOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'That image could not be uploaded.'
      );
    } finally {
      // The preview has done its job either way: on success the stored URL
      // takes over, on failure there is nothing to show.
      URL.revokeObjectURL(preview);
      setLocalPreview(null);
      setProgress(null);
    }
  };

  const applyLink = () => {
    const trimmed = linkDraft.trim();
    if (!isUsableImageUrl(trimmed)) return;
    setUploadError(null);
    onPick?.(trimmed);
    setLinkDraft('');
    setLinkOpen(false);
    setPickerOpen(false);
  };

  /**
   * Picking a poster does NOT close the tray.
   *
   * It used to, and that made comparing them impossible: you would tap one,
   * the tray would shut, you would reopen it to see the next, and so on
   * through eight. Choosing artwork is a browsing act — you want to see them
   * all against the real preview before committing.
   *
   * So selection applies immediately (the preview above updates live, which is
   * the whole point of leaving the tray open) and the tray closes only when
   * the person says they are done. Upload is the opposite and still closes on
   * its own: there is exactly one file, they already chose it in the system
   * dialog, and there is nothing left to compare it against.
   */
  const applyTemplate = (path: string) => {
    setUploadError(null);
    setFailedSrc(null);
    onPick?.(path);
  };

  const clear = () => {
    setUploadError(null);
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
          F15 is fixed: a picked file is compressed, uploaded and saved. What
          replaces the "this will not be saved" warning is honest progress —
          the upload takes a moment on a phone, and a still image with no
          indication of work is how someone taps Create before it finishes.
        */}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 size={20} className="animate-spin text-primary" />
            <p className="text-xs font-semibold">
              {progress?.stage === 'compressing'
                ? 'Shrinking the image…'
                : progress?.stage === 'finishing'
                  ? 'Almost there…'
                  : 'Uploading…'}
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
                disabled={busy}
                aria-expanded={pickerOpen}
                onClick={() => {
                  setPickerOpen((open) => !open);
                  setLinkOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background disabled:opacity-50"
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

      {/*
        The tray. Artwork first, because that is what most people need and
        none of them have; upload and paste at the end, for the ones who
        brought their own. "Use what we have, or upload yours", in that order.
      */}
      {onPick && pickerOpen && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Pick a poster
            </p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Close the poster picker"
              onClick={() => setPickerOpen(false)}
            >
              <X size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {POSTER_TEMPLATES.map((template) => {
              const selected = src === template.path;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.path)}
                  aria-pressed={selected}
                  title={template.label}
                  className={cn(
                    'relative aspect-4/5 overflow-hidden rounded-lg border-2 transition-all',
                    selected
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-border-strong'
                  )}
                >
                  <img
                    src={template.path}
                    alt={template.label}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
              or bring your own
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-full"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={13} /> Upload a photo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => setLinkOpen((open) => !open)}
            >
              <Link2 size={13} /> Paste a link
            </Button>
            {/* The only thing that dismisses the tray after browsing. Pushed
                to the end so it reads as "done", not as "confirm" — the
                choice is already applied above. */}
            <Button
              type="button"
              size="sm"
              className="ml-auto rounded-full px-4"
              onClick={() => setPickerOpen(false)}
            >
              <Check size={13} /> Done
            </Button>
          </div>
        </div>
      )}

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

      {onPick && uploadError && (
        <p className="flex items-start gap-1.5 px-1 text-[11px] text-destructive">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          {uploadError}
        </p>
      )}

      {onPick && !uploadError && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {broken
            ? 'That link did not load an image — check it, or paste another.'
            : 'Use one of our posters, upload a photo, or paste an image link. Large photos are shrunk before upload.'}
        </p>
      )}
    </div>
  );
}
