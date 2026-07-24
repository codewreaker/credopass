import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@credopass/ui/lib/utils';

/** The default event cover — a friendly illustration, Luma-style. */
export const DEFAULT_EVENT_IMAGE = '/calendar-bro.svg';

interface EventImageProps {
  /** Current image (object URL or remote). Falls back to the default. */
  src?: string;
  /**
   * When provided the image is editable: a "Change photo" affordance opens the
   * file/camera picker and reports the chosen image back. Omit for read-only.
   */
  onPick?: (url: string) => void;
  className?: string;
}

/**
 * Event cover image with an optional picker.
 *
 * Defaults to `calendar-bro.svg`. In the composer the user can replace it from a
 * file or (on mobile) the camera. Preview only for now — `events` has no cover
 * column, so a chosen image lives for the composer session; persisting it needs
 * an image column + object storage (a later backend step).
 */
export function EventImage({ src, onPick, className }: EventImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDefault = !src;
  const shown = src || DEFAULT_EVENT_IMAGE;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke the previous object URL before replacing it.
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    onPick?.(URL.createObjectURL(file));
    // Allow re-picking the same file.
    e.target.value = '';
  };

  return (
    <div className={cn('relative w-full overflow-hidden rounded-2xl border border-border bg-muted/30', className)}>
      <img
        src={shown}
        alt=""
        aria-hidden
        className={cn('block h-40 w-full sm:h-48 md:h-56', isDefault ? 'object-contain p-4' : 'object-cover')}
      />

      {onPick && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-border backdrop-blur-sm transition-colors hover:bg-background"
          >
            <ImagePlus size={13} />
            {isDefault ? 'Add photo' : 'Change photo'}
          </button>
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
  );
}
