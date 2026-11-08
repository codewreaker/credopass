// ============================================================================
// FILE: packages/lib/src/schemas/poster-templates.ts
// The built-in event posters. Shared by the composer and the API's validator.
// ============================================================================

/**
 * Posters you can use without owning one.
 *
 * Most events are made on a phone by someone who has no artwork and no
 * intention of making any, and the composer used to offer them two things they
 * did not have: a file to upload, or an https URL to paste. So every event
 * shipped with the same fallback illustration, and the poster slot — which is
 * the single biggest difference between an invitation that reads as a flyer
 * and one that reads as a naked QR code — did nothing for the common case.
 *
 * These fill it. They are vectors drawn in the product's own palette, served
 * from the app's own origin, and they cost no storage, no upload and no round
 * trip.
 *
 * **Why a root-relative path and not an https URL.** `cover_image_url`
 * otherwise holds an absolute https URL, and the API rejects anything else —
 * correctly, because an organiser's pasted link is arbitrary. A template is
 * not arbitrary: it is one of the fixed strings below, checked against this
 * list on the way in. Storing it relative is what makes it work on
 * `localhost:5000` and `app.credopass.com` alike without the row knowing which
 * one it was written on.
 *
 * This list is the contract. `services/core` imports it to validate, the
 * composer imports it to render the picker, and an id that is not here is not
 * a poster — the API will refuse it.
 */
export interface PosterTemplate {
  id: string;
  /** Shown under the swatch in the picker. */
  label: string;
  /** Root-relative, served from `apps/web/public/posters/`. */
  path: string;
}

export const POSTER_TEMPLATES: readonly PosterTemplate[] = [
  { id: 'lime-arc', label: 'Arc', path: '/posters/lime-arc.svg' },
  { id: 'midnight-grid', label: 'Grid', path: '/posters/midnight-grid.svg' },
  { id: 'sunrise', label: 'Sunrise', path: '/posters/sunrise.svg' },
  { id: 'confetti', label: 'Confetti', path: '/posters/confetti.svg' },
  { id: 'chapel', label: 'Chapel', path: '/posters/chapel.svg' },
  { id: 'wave', label: 'Wave', path: '/posters/wave.svg' },
  { id: 'spotlight', label: 'Spotlight', path: '/posters/spotlight.svg' },
  { id: 'paper', label: 'Paper', path: '/posters/paper.svg' },
] as const;

const TEMPLATE_PATHS: ReadonlySet<string> = new Set(POSTER_TEMPLATES.map((t) => t.path));

/**
 * Is this stored value one of the built-in posters?
 *
 * An exact set membership test, not a prefix or a pattern. `/posters/` is a
 * real directory on the web origin, and matching it loosely would let
 * `/posters/../../anything` through — the whole value of an allow-list is that
 * it enumerates.
 */
export const isPosterTemplatePath = (value: string | null | undefined): boolean =>
  typeof value === 'string' && TEMPLATE_PATHS.has(value);

/** The default poster a new event starts with, so the slot is never empty. */
export const DEFAULT_POSTER_TEMPLATE = POSTER_TEMPLATES[0];
