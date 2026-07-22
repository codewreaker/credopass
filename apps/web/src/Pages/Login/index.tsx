import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Zap, CheckCircle2, BarChart3, CalendarCheck, XIcon } from 'lucide-react'
import AuthPage from '@credopass/ui/components/login'
import { emailPasswordSchema } from '@credopass/lib/schemas'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code'
import {
  supabase as supabaseInstance,
  signInAsGuest,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail,
} from '../../supabase'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useGuestAutoLogin } from '../../hooks'
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon'

/** Decorative silhouette: renders an SVG as a translucent single-color mask. */
const DecorMask = ({ src, className }: { src: string; className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute ${className ?? ''}`}
    style={{
      WebkitMaskImage: `url(${src})`,
      maskImage: `url(${src})`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }}
  />
)

const FEATURES = [
  { icon: Zap,           text: 'QR check-in from any device in seconds' },
  { icon: CheckCircle2,  text: 'Real-time attendance tracking' },
  { icon: BarChart3,     text: 'Member loyalty & analytics dashboard' },
  { icon: CalendarCheck, text: 'Works alongside Eventbrite & Meetup' },
] as const

export default function LoginPage() {
  const { manual, view, out } = useSearch({ from: '/login' })
  const navigate = useNavigate({ from: '/login' })
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabaseInstance.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session)
    })
    return () => { cancelled = true }
  }, [])

  const showEmailForm = () =>
    navigate({ search: (prev) => ({ ...prev, view: 'email' }), replace: true })

  const showOptions = () =>
    navigate({ search: (prev) => ({ ...prev, view: 'social' }), replace: true })

  const isAutoSigningIn = useGuestAutoLogin(manual, supabaseInstance, signInAsGuest)

  if (isAutoSigningIn) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Setting up your session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background p-3 sm:p-4 lg:p-5 gap-4 lg:gap-6">

      {/* ── Brand billboard (tablet + desktop) ── */}
      <div className="hidden md:flex md:w-[340px] lg:w-[420px] xl:w-[480px] shrink-0 flex-col justify-between rounded-3xl bg-primary text-primary-foreground p-8 lg:p-10 relative overflow-hidden">
        {/* Decorative geometry */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-primary-foreground/8" />
        <div className="pointer-events-none absolute -left-16 bottom-24 size-44 rounded-full border-[20px] border-primary-foreground/6" />
        <DecorMask src="/login-cuate.svg" className="bg-primary-foreground/10 w-72 h-72 -bottom-6 -right-10 rotate-2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
            <CredoPassLogoIcon className="size-8 !bg-transparent !text-primary" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
        </div>

        {/* Headline + QR ticket */}
        <div className="relative z-10">
          <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.08] mb-4">
            Know who<br />actually shows up.
          </h1>
          <p className="text-sm lg:text-[15px] leading-relaxed text-primary-foreground/70 max-w-[21rem] mb-8">
            Attendance, membership and loyalty for live events — without the ticketing overhead.
          </p>

          {/* Ticket card with QR */}
          <div className="flex items-center gap-3 rounded-2xl bg-primary-foreground/10 border border-primary-foreground/15 p-4 max-w-[21rem] backdrop-blur-sm">
            <GlowingQRCode
              value="https://credopass.app"
              size={60}
              showGlow={false}
              bgColor="var(--color-primary-foreground)"
              fgColor="var(--color-primary)"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground/60 mb-1">Entry pass</p>
              <p className="text-sm font-semibold leading-snug">Scan. Check in.<br />Done in seconds.</p>
            </div>
          </div>
        </div>

        {/* Feature list */}
        <ul className="relative z-10 space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
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
        {/* Ambient glow behind form */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[480px] rounded-full bg-primary/4 blur-3xl" />
        <DecorMask src="/empty-state-one.svg" className="bg-primary/6 w-56 h-56 -bottom-8 -right-8 hidden sm:block" />

        {/* Close — back to the app for already signed-in users */}
        {hasSession && (
          <button
            type="button"
            onClick={() => navigate({ to: '/events' })}
            aria-label="Close and return to app"
            className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors duration-150 cursor-pointer"
          >
            <XIcon size={16} />
          </button>
        )}

        {/* Mobile brand header */}
        <div className="md:hidden relative z-10 m-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 flex items-center justify-between overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-[14px] border-primary-foreground/8" />
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <CredoPassLogoIcon className="size-6 !bg-primary-foreground !text-primary rounded-md" />
              <span className="text-sm font-semibold tracking-tight">CredoPass</span>
            </div>
            <p className="text-xs font-medium text-primary-foreground/70">Know who actually shows up.</p>
          </div>
          <GlowingQRCode
            value="https://credopass.app"
            size={40}
            showGlow={false}
            bgColor="var(--color-primary-foreground)"
            fgColor="var(--color-primary)"
            className="shrink-0 relative z-10"
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[340px]">
            {view === 'email' ? (
              <>
                <button
                  onClick={showOptions}
                  className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <EmailPasswordForm
                  signInCallback={(values) => signInWithEmail(values.email, values.password)}
                  signUpCallback={(values) => signUpWithEmail(values.email, values.password)}
                  schemaValidation={emailPasswordSchema as any}
                />
              </>
            ) : (
              <AuthPage
                signInAsGuest={signInAsGuest}
                signInWithGithub={signInWithGithub}
                signInAsEmail={showEmailForm}
                title={out ? 'Signed out — see you soon' : 'Welcome back'}
                subtitle={out ? 'You\u2019ve been safely signed out. Sign back in whenever you\u2019re ready.' : 'Sign in to your account to continue'}
              />
            )}
          </div>
        </div>

        <p className="relative z-10 pb-5 text-center text-[11px] text-muted-foreground/50">
          © {new Date().getFullYear()} CredoPass · Built for live events
        </p>
      </div>
    </div>
  )
}
