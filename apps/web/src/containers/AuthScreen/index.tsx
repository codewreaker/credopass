import * as React from 'react'
import { XIcon } from 'lucide-react'
import { DecorMask } from '@credopass/ui/components/decor-mask'
import CredoPassLogoIcon from '../LeftSidebar/brand-icon'

export interface AuthScreenFeature {
  icon: React.ElementType
  text: string
}

export interface AuthScreenProps {
  /** Billboard headline (may include <br/>). */
  headline: React.ReactNode
  /** Billboard supporting copy. */
  subcopy: React.ReactNode
  /** Bullet features on the billboard. */
  features: readonly AuthScreenFeature[]
  /** Optional card slot on the billboard (QR ticket, membership preview, …). */
  billboardCard?: React.ReactNode
  /** Silhouette artwork masked into the lime billboard. */
  billboardMaskSrc?: string
  /**
   * Silhouette artwork masked faintly behind the form column.
   *
   * Off by default. The screen used to carry `/empty-state-one.svg` here — a
   * figure under a large question mark — which on a sign-in page reads as
   * "something has gone wrong" to the one visitor who most needs reassurance.
   */
  formMaskSrc?: string
  /**
   * The headline a phone sees, above the form.
   *
   * Phones do not get the billboard, so without this the whole argument for
   * signing in is missing on the device most people arrive on.
   */
  mobileTagline: string
  /** Optional element rendered beside the mobile headline (e.g. a QR). */
  mobileBannerAside?: React.ReactNode
  /**
   * Rendered under the form on small screens only.
   *
   * The billboard — where the product actually gets sold — is hidden below
   * `md`, so without this a phone visitor sees a bare form and no reason to
   * fill it in.
   */
  mobileExtra?: React.ReactNode
  /**
   * Short reassurances under the sign-in control: free, no card, one tap.
   *
   * Three at most and two or three words each. This is the row that makes a
   * single OAuth button read as a considered product rather than a dead end,
   * and it is the cheapest trust signal on the page — but only while it stays
   * short enough to take in without reading.
   */
  trust?: readonly string[]
  /** The small print under the button. */
  legal?: React.ReactNode
  /** Show the round close button (returns to the app). */
  showClose?: boolean
  onClose?: () => void
  /** Footer line under the form. */
  footerText?: string
  /** The form content. */
  children: React.ReactNode
}

/** The brand lockup, at two sizes. Identical on both columns so they match. */
function Wordmark({ tone = 'surface', size = 'md' }: { tone?: 'surface' | 'onPrimary'; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-8' : 'size-9'
  const glyph = size === 'sm' ? 'size-7' : 'size-8'
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${box} items-center justify-center rounded-xl ${
          tone === 'onPrimary' ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'
        }`}
      >
        <CredoPassLogoIcon
          className={`${glyph} bg-transparent! ${tone === 'onPrimary' ? 'text-primary!' : 'text-primary-foreground!'}`}
        />
      </div>
      <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
    </div>
  )
}

/**
 * AuthScreen — the two-panel shell behind the sign-in screen.
 *
 * A lime billboard (logo, headline, copy, product card, feature list) beside a
 * form column carrying the one control the product has.
 *
 * **What was redesigned, and why.** The billboard was always the strong half;
 * the phone layout was the weak one, and the phone is where people arrive. It
 * opened with a detached lime banner carrying a one-line tagline, then roughly
 * a third of the viewport of nothing, then the headline and button sitting
 * low — so the first screenful of CredoPass was a logo and a gap. Three
 * changes:
 *
 *   1. **One column, no banner.** The lockup, headline, subcopy and button are
 *      a single vertical run with no block floating above them. The tagline is
 *      promoted to a real headline, because on a phone it is the only headline
 *      there is.
 *   2. **The reassurance row.** Free · no card · one tap, directly under the
 *      button. A screen whose whole content is one OAuth button reads as a
 *      wall unless it answers "what does pressing this cost me".
 *   3. **Small print, present.** A sign-in with no terms line looks unfinished
 *      to anyone evaluating the product for an organisation, which is who is
 *      signing up.
 *
 * The desktop panel keeps its shape and gains the same two rows, so the two
 * breakpoints say the same things in the same order.
 */
export const AuthScreen: React.FC<AuthScreenProps> = ({
  headline,
  subcopy,
  features,
  billboardCard,
  billboardMaskSrc,
  formMaskSrc,
  mobileTagline,
  mobileBannerAside,
  showClose = false,
  onClose,
  footerText,
  mobileExtra,
  trust,
  legal,
  children,
}) => {
  return (
    <div className="flex min-h-svh bg-background p-3 sm:p-4 lg:p-5 gap-4 lg:gap-6">

      {/* ── Lime billboard (tablet + desktop) ── */}
      <div className="hidden md:flex md:w-[340px] lg:w-[420px] xl:w-[480px] shrink-0 flex-col justify-between rounded-3xl bg-primary text-primary-foreground p-8 lg:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-primary-foreground/8" />
        <div className="pointer-events-none absolute -left-16 bottom-24 size-44 rounded-full border-[20px] border-primary-foreground/6" />
        {billboardMaskSrc && (
          <DecorMask src={billboardMaskSrc} className="bg-primary-foreground/10 w-72 h-72 -bottom-6 -right-10 rotate-2" />
        )}

        <div className="relative z-10">
          <Wordmark tone="onPrimary" />
        </div>

        {/* Headline + optional card */}
        <div className="relative z-10">
          <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.08] mb-4">
            {headline}
          </h1>
          <p className="text-sm lg:text-[15px] leading-relaxed text-primary-foreground/70 max-w-[21rem] mb-8">
            {subcopy}
          </p>
          {billboardCard}
        </div>

        {/* Feature list */}
        <ul className="relative z-10 space-y-2.5">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10">
                <Icon size={12} strokeWidth={2.2} />
              </div>
              <span className="text-[13px] font-medium text-primary-foreground/80">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Form column ── */}
      <div className="flex flex-1 flex-col rounded-3xl md:bg-card/40 md:border md:border-border relative overflow-hidden">
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[480px] rounded-full bg-primary/4 blur-3xl" />
        {formMaskSrc && (
          <DecorMask src={formMaskSrc} content className="bg-primary/6 w-56 h-56 -bottom-8 -right-8 hidden sm:block" />
        )}

        {/* Close — back to the app */}
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close and return to app"
            className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors duration-150 cursor-pointer"
          >
            <XIcon size={16} />
          </button>
        )}

        <div className="relative z-10 flex flex-1 flex-col justify-center p-6 pt-10 sm:p-10">
          {/*
            A card from `md` up, and no card below it.

            On a phone the form IS the page, so a border around it would be a
            box inside a box. On a desktop the column is 800px of empty panel
            and the controls floated in the middle of it with nothing holding
            them — which is what made the screen read as unfinished next to
            the billboard beside it. The card gives them an edge, a surface
            and a shadow, which is the whole of what LinkedIn's sign-in does
            differently.
          */}
          <div className="mx-auto w-full max-w-[380px] md:rounded-2xl md:border md:border-border md:bg-card md:p-8 md:shadow-elevation-2">
            {/* The phone's own header. Hidden from `md` up, where the billboard
                already carries the logo and the pitch — repeating them beside
                it would read as a duplicate.

                The pitch is a kicker above the form's own heading rather than a
                second headline. Two competing `h1`s on a 390pt screen is how
                the old layout ended up pushing the button below the fold. */}
            <div className="md:hidden">
              <div className="flex items-start justify-between gap-3">
                <Wordmark size="sm" />
                {mobileBannerAside}
              </div>
              <p className="mt-5 inline-flex rounded-full bg-primary/12 px-3 py-1 text-[11px] font-semibold tracking-tight text-primary">
                {mobileTagline}
              </p>
              <div className="mt-5 mb-6 h-px bg-border" />
            </div>

            {children}

            {legal && (
              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                {legal}
              </p>
            )}

            {trust && trust.length > 0 && (
              <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                {trust.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center rounded-full border border-border bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {/* The product, on the one breakpoint that cannot see the
                billboard. Below the button on purpose: proof supports the
                decision, it does not compete with it. */}
            {mobileExtra && <div className="md:hidden mt-8">{mobileExtra}</div>}
          </div>
        </div>

        {footerText && (
          <p className="relative z-10 pb-5 text-center text-[11px] text-muted-foreground/50">
            {footerText}
          </p>
        )}
      </div>
    </div>
  )
}

export default AuthScreen
