import { useEffect, useState } from 'react'
import { Zap, CheckCircle2, BarChart3, CalendarCheck } from 'lucide-react'
import AuthPage from '@credopass/ui/components/login'
import { supabase as supabaseInstance, signInWithGoogle } from '../../supabase'
import { authErrorSearch } from '../../lib/auth-error'
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
  const { out, redirect } = useSearch({ from: '/login' })
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

  return (
    <AuthScreen
      headline={<>Know who<br />actually shows up.</>}
      subcopy="Attendance and membership for live events — without the ticketing overhead."
      features={FEATURES}
      billboardCard={<AppShowcase />}
      billboardMaskSrc="/login-cuate.svg"
      mobileTagline="Know who actually shows up."
      // No QR beside the mobile lockup. It was a 40px code pointing at the
      // marketing site, rendered on the one device that cannot scan its own
      // screen — decoration where the eye should be travelling to the button.
      mobileExtra={<AppShowcase tone="onSurface" className="mx-auto" />}
      // Three, and short enough to sit on ONE line at 375pt. A fourth word in
      // any of them wraps the last chip onto a row of its own, which reads as
      // a mistake rather than a list.
      trust={['Free to start', 'No card', 'One tap']}
      legal={<>We only read your name and email address from Google.</>}
      showClose={hasSession}
      onClose={() => (navigate as any)({ to: destination })}
      footerText={`© ${new Date().getFullYear()} CredoPass · Built for live events`}
    >
      <AuthPage
        signInWithGoogle={() => signInWithGoogle(destination)}
        onError={(error) =>
          (navigate as any)({ to: '/auth/error', search: authErrorSearch(error) })
        }
        title={out ? 'Signed out — see you soon' : 'Welcome back'}
        subtitle={
          out
            ? 'You’ve been safely signed out. Sign back in whenever you’re ready.'
            : 'Google is the only way in — one tap, no password to forget.'
        }
      />
    </AuthScreen>
  )
}
