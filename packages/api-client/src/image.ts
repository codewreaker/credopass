/**
 * Client-side image compression. ROADMAP stage 4.2 (F12).
 *
 * **This is the layer that matters.** A phone photo is 4–12MB and a poster
 * never needs more than about 2048px on its long edge. Downscaling before the
 * PUT means those bytes never cross the network — which is cheaper than any
 * amount of server-side processing, and is the difference between a pass that
 * loads instantly on a bad connection at a church door and one that does not.
 *
 * Server-side derivatives (AVIF/WebP at card and thumbnail widths, via
 * `sharp`) are still worth having and are **not built yet** — they are the
 * rest of 4.2. This gets the big win first.
 *
 * ## Why canvas and not a library
 *
 * `createImageBitmap` + `OffscreenCanvas` is in every browser we support, and
 * it does exactly one thing: decode, scale, re-encode. A compression library
 * would add a dependency to do the same three calls, and the interesting part
 * here is not the resizing — it is the decisions below about *when not to*.
 */

/** Longest edge after downscaling. Comfortably more than any poster needs. */
const MAX_EDGE = 2048;

/**
 * Quality for the re-encode. 0.82 is the usual knee: visually indistinguishable
 * from 0.95 on a photograph, roughly half the bytes.
 */
const QUALITY = 0.82;

/**
 * Below this, re-encoding is not worth it.
 *
 * A small file is often already optimised — an exported WebP, a designed
 * poster — and running it through a lossy canvas round-trip would make it
 * *larger* as well as worse. See the guard in `compressImage`.
 */
const SKIP_UNDER_BYTES = 400 * 1024;

export interface CompressedImage {
  blob: Blob;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  /** True when the original was returned untouched. */
  passthrough: boolean;
}

/** What the API will sign for. Anything else has to become one of these. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'] as const;

const isAccepted = (type: string): type is CompressedImage['contentType'] =>
  (ACCEPTED as readonly string[]).includes(type);

const canvasSupported = (): boolean =>
  typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function';

/**
 * Downscale and re-encode an image for upload.
 *
 * Returns the original untouched when compressing would not help or cannot be
 * done. **Never throws for a compression failure** — a browser that cannot
 * run the canvas path should still be able to upload, just less efficiently.
 * The server's size ceiling is what catches the pathological case.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const originalType = file.type.toLowerCase();

  // PNG is kept as PNG when it is small: it is the format people use for
  // flat-colour designs with sharp edges, and JPEG is the wrong codec for
  // those — it would add ringing around text on a poster.
  const alreadySmall = file.size < SKIP_UNDER_BYTES;

  if (!canvasSupported() || (alreadySmall && isAccepted(originalType))) {
    return {
      blob: file,
      contentType: isAccepted(originalType) ? originalType : 'image/jpeg',
      width: 0,
      height: 0,
      passthrough: true,
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // JPEG for photographs. Transparency is not preserved, which is correct
    // for a poster that will be composited onto a lime billboard — a
    // transparent PNG there would show the billboard through it.
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });

    // If the round-trip made it bigger, keep the original. This happens with
    // already-optimised files and is the whole reason for measuring rather
    // than assuming compression is an improvement.
    if (blob.size >= file.size && isAccepted(originalType)) {
      return {
        blob: file,
        contentType: originalType,
        width: bitmap.width,
        height: bitmap.height,
        passthrough: true,
      };
    }

    return { blob, contentType: 'image/jpeg', width, height, passthrough: false };
  } catch {
    // Decoding can fail on a corrupt file, an unsupported codec, or a HEIC
    // the browser will not touch. Hand the original over and let the server
    // reject it with a message, rather than failing here with a canvas error
    // nobody can act on.
    return {
      blob: file,
      contentType: isAccepted(originalType) ? originalType : 'image/jpeg',
      width: 0,
      height: 0,
      passthrough: true,
    };
  }
}
