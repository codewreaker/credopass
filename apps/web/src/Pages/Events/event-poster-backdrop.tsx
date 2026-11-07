/**
 * The event poster, behind a lime billboard.
 *
 * Shared by the event detail screen and the public event page so the two
 * cannot drift — they render the same billboard and used to do it twice.
 *
 * **Why it is a backdrop and not a banner.** The billboard carries the event
 * name at `text-3xl` in `text-primary-foreground`, which is near-black on lime
 * and relies on the lime being there. Put an arbitrary photograph behind that
 * text at full strength and the contrast becomes whatever the organiser
 * happened to paste — a dark photo makes the title vanish.
 *
 * So the lime stays the base layer and the poster sits on top of it at low
 * opacity, under a gradient that is fully opaque where the text actually is.
 * The result reads as a textured billboard rather than a photo card, and the
 * title is legible over any image. A real full-bleed poster treatment is stage
 * 4's job, once we host the bytes and can say something about what they are.
 *
 * A broken link renders nothing at all: `onError` hides the element, leaving
 * the plain lime billboard that every event had before posters existed.
 */
import { useState } from 'react';

export function EventPosterBackdrop({ src }: { src: string | null | undefined }) {
  // Remembering WHICH url failed, rather than a boolean, means a new `src`
  // starts clean with no effect to reset it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <img
        src={src}
        alt=""
        onError={() => setFailedSrc(src)}
        className="size-full object-cover opacity-30 mix-blend-luminosity"
      />
      {/* Opaque at the bottom, where the title and the meta rows sit. */}
      <div className="absolute inset-0 bg-linear-to-t from-primary via-primary/80 to-primary/40" />
    </div>
  );
}
