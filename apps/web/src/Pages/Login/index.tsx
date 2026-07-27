import { useEffect, useState } from 'react'
import { ArrowLeft, Zap, CheckCircle2, BarChart3, CalendarCheck } from 'lucide-react'
import AuthPage from '@credopass/ui/components/login'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code'
import {
  supabase as supabaseInstance,
  sendPasswordReset,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail,
} from '../../supabase'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AuthScreen } from '../../containers/AuthScreen'
import { AppShowcase } from './app-showcase'

const FEATURES = [
  { icon: Zap,           text: 'QR check-in from any device in seconds' },
  { icon: CheckCircle2,  text: 'Real-time attendance tracking' },
  { icon: BarChart3,     text: 'Attendance history for every member' },
  { icon: CalendarCheck, text: 'Works alongside Eventbrite & Meetup' },
] as const

export default function LoginPage() {
  const { view, out, redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate({ from: '/login' })
  const [hasSession, setHasSession] = useState(false)

  // Where to land after auth: the private route the guard sent us back from
  // (same-origin relative paths only), else the events home.
  const destination = (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) ? redirect : '/events'

  useEffect(() => {
    let cancelled = false
    supabaseInstance.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session)
    })
    return () => { cancelled = true }
  }, [])

  // Land the person where they were headed once a session appears.
  //
  // `replace`, not push: the sign-in screen must not sit in history behind the
  // app, or Back returns here and bounces straight forward again.
  useEffect(() => {
    const { data: sub } = supabaseInstance.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        (navigate as any)({ to: destination, replace: true })
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [destination, navigate])

  const showEmailForm = () =>
    navigate({ search: (prev) => ({ ...prev, view: 'email' }), replace: true })

  const showOptions = () =>
    navigate({ search: (prev) => ({ ...prev, view: 'social' }), replace: true })

  return (
    <AuthScreen
      headline={<>Know who<br />actually shows up.</>}
      subcopy="Attendance and membership for live events — without the ticketing overhead."
      features={FEATURES}
      billboardCard={<AppShowcase />}
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
      mobileExtra={<AppShowcase className="mx-auto" />}
      showClose={hasSession}
      onClose={() => (navigate as any)({ to: destination })}
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
            resetCallback={(email) => sendPasswordReset(email)}
          />
        </>
      ) : (
        <AuthPage
          signInWithGithub={signInWithGithub}
          signInAsEmail={showEmailForm}
          title={out ? 'Signed out — see you soon' : 'Welcome back'}
          subtitle={out ? 'You’ve been safely signed out. Sign back in whenever you’re ready.' : 'Sign in to your account to continue'}
        />
      )}
    </AuthScreen>
  )
}
