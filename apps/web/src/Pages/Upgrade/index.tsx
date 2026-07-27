import { useState } from 'react'
import { ArrowLeft, CheckCircle2, History, BarChart3, Users, Shield, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@credopass/ui/components/button'
import { Input } from '@credopass/ui/components/input'
import { useNavigate } from '@tanstack/react-router'
import { AuthScreen } from '../../containers/AuthScreen'

const UPGRADE_BENEFITS = [
  { icon: History,   text: 'Keep every check-in on your record' },
  { icon: BarChart3, text: 'Full attendance history across all events' },
  { icon: Users,     text: 'Member profile visible to organizers' },
  { icon: Shield,    text: 'Secure account — your data, always' },
] as const

/** Live membership card — updates as the guest types their email. */
const MembershipCardPreview = ({ email }: { email: string }) => (
  <div className="rounded-2xl bg-primary-foreground text-primary p-4 max-w-[21rem] shadow-elevation-3">
    <div className="flex items-center justify-between mb-5">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">CredoPass member</span>
      <Sparkles size={14} />
    </div>
    <p className="text-lg font-semibold tracking-tight truncate">{email || 'you@example.com'}</p>
    <div className="flex items-center justify-between mt-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">Events</p>
        <p className="text-xl font-bold tabular-nums leading-tight">0</p>
      </div>
      <div className="text-right">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">Since</p>
        <p className="text-xl font-bold leading-tight">Today</p>
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
    <AuthScreen
      headline={<>Keep everything<br />you&rsquo;ve earned.</>}
      subcopy="You’re in guest mode. Create a free account to save your check-ins and keep your attendance history."
      features={UPGRADE_BENEFITS}
      billboardCard={<MembershipCardPreview email={email} />}
      billboardMaskSrc="/empty-state-two.svg"
      mobileTagline="Keep everything you’ve earned — create a free account."
      showClose
      onClose={handleBack}
      footerText={`© ${new Date().getFullYear()} CredoPass · Free forever for attendees`}
    >
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
    </AuthScreen>
  )
}
