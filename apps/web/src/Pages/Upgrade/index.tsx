import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Star, BarChart3, Users, Shield, Loader2 } from 'lucide-react'
import { Button } from '@credopass/ui/components/button'
import { Input } from '@credopass/ui/components/input'
import { useNavigate } from '@tanstack/react-router'
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon'

const UPGRADE_BENEFITS = [
  { icon: Star,      text: 'Earn loyalty points at every event' },
  { icon: BarChart3, text: 'Full attendance history across all events' },
  { icon: Users,     text: 'Member profile visible to organizers' },
  { icon: Shield,    text: 'Secure account — your data, always' },
] as const

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
          <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle2 size={22} className="text-primary" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-2">Account created</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Check your inbox to confirm your email, then sign back in.
          </p>
          <Button className="w-full" onClick={() => navigate({ to: '/login', search: { view: 'email', manual: true } })}>
            Sign in to your new account
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-background">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col justify-between p-10 border-r border-border bg-card/50 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -left-40 size-80 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-16">
            <CredoPassLogoIcon className="size-8" />
            <span className="text-sm font-semibold tracking-tight">CredoPass</span>
          </div>

          <div className="mb-10">
            <h1 className="text-[1.6rem] font-semibold tracking-tight leading-snug mb-3">
              Unlock your full<br />
              <span className="text-primary">member profile.</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[17rem]">
              You're currently in guest mode. Create a free account to save your progress and earn loyalty points.
            </p>
          </div>

          <ul className="space-y-3">
            {UPGRADE_BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Icon size={11} className="text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px] text-muted-foreground/50">
          © {new Date().getFullYear()} CredoPass · Free forever for attendees
        </p>
      </div>

      {/* Right panel: form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="lg:hidden flex items-center gap-2 mb-10 self-start">
          <CredoPassLogoIcon className="size-7" />
          <span className="text-sm font-semibold tracking-tight">CredoPass</span>
        </div>

        <div className="w-full max-w-[340px]">
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to app
          </button>

          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Free forever. No credit card required.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
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
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading
                ? <><Loader2 size={14} className="animate-spin" /> Creating account…</>
                : 'Create account'}
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
    </div>
  )
}
