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
  /** Silhouette artwork masked faintly behind the form column. */
  formMaskSrc?: string
  /** One-line tagline shown in the mobile brand banner. */
  mobileTagline: string
  /** Optional element rendered on the right of the mobile banner (e.g. a QR). */
  mobileBannerAside?: React.ReactNode
  /**
   * Rendered under the form on small screens only.
   *
   * The billboard — where the product actually gets sold — is hidden below
   * `md`, so without this a phone visitor sees a bare form and no reason to
   * fill it in.
   */
  mobileExtra?: React.ReactNode
  /** Show the round close button (returns to the app). */
  showClose?: boolean
  onClose?: () => void
  /** Footer line under the form. */
  footerText?: string
  /** The form content. */
  children: React.ReactNode
}

/**
 * AuthScreen — the shared two-panel shell behind Login, Logout and Upgrade.
 * A lime billboard (logo, headline, copy, optional card, feature list) beside a
 * form column with an optional close button and a mobile brand banner. Pages
 * supply only what differs via props/slots.
 */
export const AuthScreen: React.FC<AuthScreenProps> = ({
  headline,
  subcopy,
  features,
  billboardCard,
  billboardMaskSrc,
  formMaskSrc = '/empty-state-one.svg',
  mobileTagline,
  mobileBannerAside,
  showClose = false,
  onClose,
  footerText,
  mobileExtra,
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

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
            <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
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

        {/* Mobile brand banner */}
        <div className="md:hidden relative z-10 m-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 flex items-center justify-between gap-3 overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-[14px] border-primary-foreground/8" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <CredoPassLogoIcon className="size-6 bg-primary-foreground! text-primary! rounded-md" />
              <span className="text-sm font-semibold tracking-tight">CredoPass</span>
            </div>
            <p className="text-xs font-medium text-primary-foreground/70">{mobileTagline}</p>
          </div>
          {mobileBannerAside}
        </div>

        {/* Form content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[340px]">
            {children}
          </div>
          {mobileExtra && (
            <div className="md:hidden w-full max-w-85 mt-8">{mobileExtra}</div>
          )}
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
