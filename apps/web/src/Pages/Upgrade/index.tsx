import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Star, BarChart3, Users, Shield, Loader2, Sparkles, XIcon } from 'lucide-react'
import { Button } from '@credopass/ui/components/button'
import { Input } from '@credopass/ui/components/input'
import { useNavigate } from '@tanstack/react-router'
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

const UPGRADE_BENEFITS = [
  { icon: Star,      text: 'Earn loyalty points at every event' },
  { icon: BarChart3, text: 'Full attendance history across all events' },
  { icon: Users,     text: 'Member profile visible to organizers' },
  { icon: Shield,    text: 'Secure account — your data, always' },
] as const

/** Mock membership card shown on the billboard — what the guest is about to unlock */
const MembershipCardPreview = ({ email }: { email: string }) => (
  <div className="rounded-2xl bg-primary-foreground text-primary p-4 max-w-[21rem] shadow-elevation-3">
    <div className="flex items-center justify-between mb-5">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">CredoPass member</span>
      <Sparkles size={14} />
    </div>
    <p className="text-lg font-semibold tracking-tight truncate">{email || 'you@example.com'}</p>
    <div className="flex items-center justify-between mt-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">Points</p>
        <p className="text-xl font-bold tabular-nums leading-tight">0 → ∞</p>
      </div>
      <div className="text-right">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">Tier</p>
        <p className="text-xl font-bold leading-tight">Bronze</p>
      </div>
    </div>
  </div>
)

export default function UpgradePage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'register' | 'success'>('register')

  const handleBack = () => navigate({ to: '/events' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setIsLoading(true)
    try {
      // TODO: wire to signUpWithEmail from Supabase auth client
      await new Promise(r => setTimeout(r, 1000)) // placeholder
      setMode('success')
    } catch {
      // handle error
    } finally {
      setIsLoading(false)
    }
  }

  if (mode === 'success') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">Account created</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Check your inbox to confirm your email, then sign back in.
          </p>
          <Button className="w-full h-11 rounded-full font-semibold" onClick={() => navigate({ to: '/login', search: { view: 'email', manual: true } })}>
            Sign in to your new account
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background p-3 sm:p-4 lg:p-5 gap-4 lg:gap-6">

      {/* ── Lime billboard (tablet + desktop) ── */}
      <div className="hidden md:flex md:w-[340px] lg:w-[420px] xl:w-[480px] shrink-0 flex-col justify-between rounded-3xl bg-primary text-primary-foreground p-8 lg:p-10 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-[28px] border-primary-foreground/8" />
        <div className="pointer-events-none absolute -left-16 bottom-24 size-44 rounded-full border-[20px] border-primary-foreground/6" />
        <DecorMask src="/empty-state-two.svg" className="bg-primary-foreground/10 w-64 h-64 -bottom-4 -right-8" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
            <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.08] mb-4">
            Keep everything<br />you&rsquo;ve earned.
          </h1>
          <p className="text-sm lg:text-[15px] leading-relaxed text-primary-foreground/70 max-w-[21rem] mb-8">
            You&rsquo;re in guest mode. Create a free account to save your check-ins and start climbing the loyalty tiers.
          </p>
          <MembershipCardPreview email={email} />
        </div>

        <ul className="relative z-10 space-y-2.5">
          {UPGRADE_BENEFITS.map(({ icon: Icon, text }) => (
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
        <DecorMask src="/empty-state-one.svg" className="bg-primary/6 w-56 h-56 -bottom-8 -right-8 hidden sm:block" />

        {/* Close — back to the app */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="Close and return to app"
          className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors duration-150 cursor-pointer"
        >
          <XIcon size={16} />
        </button>

        {/* Mobile brand banner */}
        <div className="md:hidden relative z-10 m-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full border-[14px] border-primary-foreground/8" />
          <div className="flex items-center gap-2 mb-1.5">
            <CredoPassLogoIcon className="size-6 bg-primary-foreground! text-primary! rounded-md" />
            <span className="text-sm font-semibold tracking-tight">CredoPass</span>
          </div>
          <p className="text-xs font-medium text-primary-foreground/70">Keep everything you&rsquo;ve earned — create a free account.</p>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[340px]">
            <button
              onClick={handleBack}
              className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
            >
              <ArrowLeft size={14} />
              Back to app
            </button>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Free forever. No credit card required.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="h-11 rounded-xl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  className="h-11 rounded-xl"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full h-11 rounded-full font-semibold mt-2" disabled={isLoading}>
                {isLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Creating account…</>
                  : 'Create free account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={handleBack}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
              >
                Continue as guest instead
              </button>
            </div>
          </div>
        </div>

        <p className="relative z-10 pb-5 text-center text-[11px] text-muted-foreground/50">
          © {new Date().getFullYear()} CredoPass · Free forever for attendees
        </p>
      </div>
    </div>
  )
}
