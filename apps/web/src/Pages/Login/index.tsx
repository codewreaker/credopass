import { ArrowLeft, Loader2, Zap, CheckCircle2, BarChart3, CalendarCheck } from 'lucide-react'
import AuthPage from '@credopass/ui/components/login'
import { emailPasswordSchema } from '@credopass/lib/schemas'
import { createAuthClient, createClient } from '@credopass/lib/supabase'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { SUPASE_CRED } from '../../config'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useGuestAutoLogin } from '../../hooks'
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon'
import LoginSVG from '/login-cuate.svg'

const supabaseInstance = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)

const { signInAsGuest, signInWithEmail, signInWithGithub, signUpWithEmail } =
  createAuthClient(supabaseInstance)

const FEATURES = [
  { icon: Zap,           text: 'QR check-in from any device in seconds' },
  { icon: CheckCircle2,  text: 'Real-time attendance tracking' },
  { icon: BarChart3,     text: 'Member loyalty & analytics dashboard' },
  { icon: CalendarCheck, text: 'Works alongside Eventbrite & Meetup' },
] as const

export default function LoginPage() {
  const { manual, view } = useSearch({ from: '/login' })
  const navigate = useNavigate({ from: '/login' })

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
    <div className="flex min-h-svh bg-background">

      {/* ── Left panel: brand + value prop (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col justify-between p-10 border-r border-border bg-card/50 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 size-56 rounded-full bg-primary/3 blur-3xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-16">
            <CredoPassLogoIcon className="size-8" />
            <span className="text-sm font-semibold tracking-tight">CredoPass</span>
          </div>

          {/* Tagline */}
          <div className="mb-10">
            <h1 className="text-[1.6rem] font-semibold tracking-tight leading-snug mb-3">
              Event credentialing<br />
              <span className="text-primary">that just works.</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[17rem]">
              Track attendance, manage members, and run QR check-ins — without the ticketing overhead.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Icon size={11} className="text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          {/* Illustration */}
          <img src={LoginSVG} alt="" className="mt-10 w-full max-w-[300px] mx-auto" />
        </div>

        <p className="relative z-10 text-[11px] text-muted-foreground/50">
          © {new Date().getFullYear()} CredoPass · Built for live events
        </p>
      </div>

      {/* ── Right panel: auth form ── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10 self-start">
          <CredoPassLogoIcon className="size-7" />
          <span className="text-sm font-semibold tracking-tight">CredoPass</span>
        </div>

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
            />
          )}
        </div>
      </div>
    </div>
  )
}
