import { useEffect, useState } from 'react'

/**
 * What a signed-out visitor sees instead of the product.
 *
 * With anonymous sign-in gone, the login screen is the only thing between
 * someone and the app — so it has to argue for itself. These are real captures
 * of real screens, not illustrations, and each one carries a caption naming the
 * job it does.
 *
 * The `audit/shots` originals are cropped at build-prep time to 16:9 and
 * converted to webp (~20KB each). The events shot is cropped BELOW its greeting
 * line on purpose: the original reads "Good evening, Israel" over a real
 * organisation name, which should not ship on a public page.
 */
interface Shot {
  src: string
  caption: string
  alt: string
}

const SHOTS: readonly Shot[] = [
  {
    src: '/showcase/checkin.webp',
    caption: 'Scan to check in — no app, no queue',
    alt: 'A full-screen check-in QR code on a door tablet',
  },
  {
    src: '/showcase/events.webp',
    caption: 'Every event, and who is coming',
    alt: 'The events dashboard showing the next event and a calendar',
  },
  {
    src: '/showcase/public-event.webp',
    caption: 'A shareable page for every event',
    alt: 'A public event page with a registration code and QR',
  },
] as const

const INTERVAL_MS = 5000

/**
 * Which surface this sits on.
 *
 * The billboard is lime, so its chrome and caption use `primary-foreground`.
 * The mobile placement sits on the dark form column, where those same tokens
 * render dark-on-dark and the caption disappears. Two token sets rather than
 * one, because the two backgrounds are genuinely opposite.
 */
type Tone = 'onPrimary' | 'onSurface'

const TONES: Record<Tone, { frame: string; dot: string; caption: string; on: string; off: string }> = {
  onPrimary: {
    frame: 'border-primary-foreground/15 bg-primary-foreground/10',
    dot: 'bg-primary-foreground/25',
    caption: 'text-primary-foreground/85',
    on: 'bg-primary-foreground/80',
    off: 'bg-primary-foreground/30 hover:bg-primary-foreground/50',
  },
  onSurface: {
    frame: 'border-border bg-card',
    dot: 'bg-muted-foreground/30',
    caption: 'text-muted-foreground',
    on: 'bg-primary',
    off: 'bg-border hover:bg-muted-foreground/40',
  },
}

export function AppShowcase({
  className = '',
  tone = 'onPrimary',
}: {
  className?: string
  tone?: Tone
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const t = TONES[tone]

  useEffect(() => {
    // Someone who asked for less motion gets the first frame and no rotation.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || paused) return

    const id = window.setInterval(() => setIndex((i) => (i + 1) % SHOTS.length), INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [paused])

  const current = SHOTS[index]

  return (
    <div
      className={`w-full max-w-84 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Device frame */}
      <div className={`rounded-2xl border p-1.5 backdrop-blur-sm shadow-lg ${t.frame}`}>
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <span className={`size-1.5 rounded-full ${t.dot}`} />
          <span className={`size-1.5 rounded-full ${t.dot}`} />
          <span className={`size-1.5 rounded-full ${t.dot}`} />
        </div>

        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          {SHOTS.map((shot, i) => (
            <img
              key={shot.src}
              src={shot.src}
              alt={shot.alt}
              width={900}
              height={506}
              // Only the first is eager: the rest are decorative until they
              // rotate in, and blocking first paint on three images to show one
              // is the wrong trade on a login screen.
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              aria-hidden={i !== index}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Caption + indicators */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`text-[13px] font-medium leading-snug ${t.caption}`} aria-live="polite">
          {current.caption}
        </p>
        <div className="flex shrink-0 gap-1.5">
          {SHOTS.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show: ${shot.caption}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                i === index ? `w-5 ${t.on}` : `w-1.5 ${t.off}`
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default AppShowcase
