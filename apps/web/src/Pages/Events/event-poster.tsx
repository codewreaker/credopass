/**
 * The event poster, shown as itself.
 *
 * Shared by the event detail screen and the public event page so the two
 * cannot drift — they render the same card and used to do it twice.
 *
 * **Why this replaced the backdrop.** Until stage 4 the poster was a texture:
 * `opacity-30` + `mix-blend-luminosity` behind the lime billboard, under a
 * gradient that was fully opaque where the title sits. That was the right call
 * while the bytes were arbitrary pasted URLs — an organiser's dark photograph
 * behind near-black `text-primary-foreground` makes the title vanish, and the
 * contrast became whatever they happened to paste.
 *
 * Two things changed. We host the bytes now (R2, 2026-11-07), and the layout
 * no longer puts text on the image at all: the poster is its own card and the
 * billboard sits below it. Nothing has to stay legible over the picture, so
 * nothing has to be dimmed, tinted or blended. The poster is the thing the
 * organiser chose; showing a ghost of it was worse than showing none.
 *
 * **It is never cropped.** `object-contain` against a muted backing, capped at
 * `32rem` tall. Event posters are usually portrait and usually carry type at
 * the very top — the first thing a `cover` crop eats. Letterboxing a wide
 * image is a smaller cost than guillotining a title.
 *
 * A broken link renders nothing at all: `onError` hides the element, leaving
 * the plain lime billboard that every event had before posters existed.
 */
import { useState } from 'react';

export function EventPoster({ src, eventName }: { src: string | null | undefined; eventName?: string }) {
  // Remembering WHICH url failed, rather than a boolean, means a new `src`
  // starts clean with no effect to reset it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return null;

  return (
    <div className="relative rounded-3xl bg-muted shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)]">
      <img
        src={src}
        // The poster is content now, not decoration, so it gets a real name.
        alt={eventName ? `Poster for ${eventName}` : 'Event poster'}
        onError={() => setFailedSrc(src)}
        className="block max-h-128 w-full rounded-3xl object-contain"
      />

      {/*
        The lit edge, brightest at the top-left and picked up again at the
        bottom-right, as though a light source sat off that corner.

        Two layers, not one, because a poster can be any artwork. A white
        highlight is invisible on a white poster and a dark hairline disappears
        into a dark one, so the card carries BOTH: a neutral dark edge that
        defines the card against pale artwork, and the white gradient on top
        that reads as shine against dark artwork. On any given poster one of
        them does the work and the other costs nothing.

        Both are painted with the standard masked-gradient border trick —
        `p-px` + `mask-composite: exclude` keeps the fill to the 1px frame — so
        this is a real edge rather than a tint over the image.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl p-px [background:linear-gradient(135deg,rgba(0,0,0,0.28),rgba(0,0,0,0.10)_35%,rgba(0,0,0,0.10)_65%,rgba(0,0,0,0.22))] [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl p-0.5 [background:linear-gradient(135deg,rgba(255,255,255,0.85),rgba(255,255,255,0.05)_32%,rgba(255,255,255,0.05)_68%,rgba(255,255,255,0.6))] [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
      />
    </div>
  );
}
