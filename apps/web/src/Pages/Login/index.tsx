import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Zap, CheckCircle2, BarChart3, CalendarCheck } from 'lucide-react'
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
import { AuthScreen } from '../../containers/AuthScreen'

const FEATURES = [
  { icon: Zap,           text: 'QR check-in from any device in seconds' },
  { icon: CheckCircle2,  text: 'Real-time attendance tracking' },
  { icon: BarChart3,     text: 'Member loyalty & analytics dashboard' },
  { icon: CalendarCheck, text: 'Works alongside Eventbrite & Meetup' },
] as const

/** QR entry-pass card on the billboard. */
const EntryPassCard = () => (
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
)

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
    <AuthScreen
      headline={<>Know who<br />actually shows up.</>}
      subcopy="Attendance, membership and loyalty for live events — without the ticketing overhead."
      features={FEATURES}
      billboardCard={<EntryPassCard />}
      billboardMaskSrc="/login-cuate.svg"
      mobileTagline="Know who actually shows up."
      mobileBannerAside={
        <GlowingQRCode
          value="https://credopass.app"
          size={40}
          showGlow={false}
          bgColor="var(--color-primary-foreground)"
          fgColor="var(--color-primary)"
          className="shrink-0 relative z-10"
        />
      }
      showClose={hasSession}
      onClose={() => navigate({ to: '/events' })}
      footerText={`© ${new Date().getFullYear()} CredoPass · Built for live events`}
    >
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
          subtitle={out ? 'You’ve been safely signed out. Sign back in whenever you’re ready.' : 'Sign in to your account to continue'}
        />
      )}
    </AuthScreen>
  )
}
