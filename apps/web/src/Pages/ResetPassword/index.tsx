import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Loader2, ShieldAlert, Zap, BarChart3, CalendarCheck } from 'lucide-react'
import { Button } from '@credopass/ui/components/button'
import { Label } from '@credopass/ui/components/label'
import { PasswordInput } from '@credopass/ui/components/login/password-input'
import { PASSWORD_RULES, resetPasswordSchema } from '@credopass/lib/schemas'
import { supabase, updatePassword } from '../../supabase'
import { AuthScreen } from '../../containers/AuthScreen'

const FEATURES = [
  { icon: Zap,           text: 'QR check-in from any device in seconds' },
  { icon: CheckCircle2,  text: 'Real-time attendance tracking' },
  { icon: BarChart3,     text: 'Attendance history for every member' },
  { icon: CalendarCheck, text: 'Works alongside Eventbrite & Meetup' },
] as const

type Status = 'checking' | 'ready' | 'invalid' | 'done'

/**
 * Set a new password from a recovery link.
 *
 * The link carries its token in the URL fragment. `supabase-js` consumes it on
 * load and emits `PASSWORD_RECOVERY`, which is the only signal that the person
 * is genuinely holding a valid link — so the form stays hidden until it arrives
 * rather than letting someone type a password that can never be saved.
 *
 * The listener is registered BEFORE the fallback `getSession` check, because
 * the event can fire during that await and a listener attached afterwards would
 * miss it entirely.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [formError, setFormError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let settled = false

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true
        setStatus('ready')
      }
    })

    // A link already consumed on a previous render leaves a session behind with
    // no further event to wait for.
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return
      setStatus(data.session ? 'ready' : 'invalid')
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onChange: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await updatePassword(value.password)
      if (error) {
        setFormError(error.message)
        return
      }
      setStatus('done')
    },
  })

  const body = () => {
    if (status === 'checking') {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking your link…</p>
        </div>
      )
    }

    if (status === 'invalid') {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              This link has expired
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Reset links are single-use and last an hour. Request a fresh one and it will work.
            </p>
          </div>
          <Button
            className="w-full rounded-full"
            onClick={() => navigate({ to: '/login', search: { view: 'email' } })}
          >
            Back to sign in
          </Button>
        </div>
      )
    }

    if (status === 'done') {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Password updated
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You&rsquo;re signed in with your new password.
            </p>
          </div>
          <Button className="w-full rounded-full" onClick={() => navigate({ to: '/events' })}>
            Continue to CredoPass
          </Button>
        </div>
      )
    }

    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Choose a new password
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Make it something you haven&rsquo;t used here before.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>New password</Label>
                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                />
                <div className="flex gap-1 pt-1" aria-hidden>
                  {PASSWORD_RULES.map((rule, i) => (
                    <span
                      key={rule.label}
                      className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                        i < PASSWORD_RULES.filter((r) => r.test(field.state.value)).length
                          ? 'bg-primary'
                          : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                {field.state.meta.isTouched && (field.state.meta.errors[0] as { message?: string } | undefined)?.message && (
                  <p className="text-xs text-destructive">
                    {(field.state.meta.errors[0] as { message: string }).message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={field.name}>Confirm new password</Label>
                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                />
                {field.state.meta.isTouched && (field.state.meta.errors[0] as { message?: string } | undefined)?.message && (
                  <p className="text-xs text-destructive">
                    {(field.state.meta.errors[0] as { message: string }).message}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {formError && <p className="text-xs text-destructive">{formError}</p>}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Update password
              </Button>
            )}
          </form.Subscribe>
        </form>
      </>
    )
  }

  return (
    <AuthScreen
      headline={<>Back in,<br />in one step.</>}
      subcopy="Set a new password and pick up exactly where you left off."
      features={FEATURES}
      billboardMaskSrc="/login-cuate.svg"
      mobileTagline="Set a new password."
      footerText={`© ${new Date().getFullYear()} CredoPass · Built for live events`}
    >
      {body()}
    </AuthScreen>
  )
}
