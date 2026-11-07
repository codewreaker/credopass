import { useRef, useState } from 'react';
import { useUploadImage, type UploadProgress } from '@credopass/api-client';
import { AlertTriangle, ImagePlus, Link2, Loader2, Trash2, X } from 'lucide-react';
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
                onClick={() => setLinkOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background"
              >
                <Link2 size={13} />
                Paste link
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
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
            : 'Add a photo or paste an image link. Large photos are shrunk before upload.'}
        </p>
      )}
    </div>
  );
}
