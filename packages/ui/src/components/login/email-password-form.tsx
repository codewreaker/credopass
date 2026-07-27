import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { ArrowLeft, Check, Loader2, MailCheck } from 'lucide-react'
import {
  PASSWORD_RULES,
  emailPasswordSchema,
  forgotPasswordSchema,
  passwordStrength,
  signUpSchema,
} from '@credopass/lib/schemas'

import { Button } from '../button'
import { Input } from '../input'
import { Label } from '../label'
import { PasswordInput } from './password-input'
import { cn } from '../../lib/utils'

export type EmailPasswordValues = { email: string; password: string }
export type AuthMode = 'signIn' | 'signUp' | 'forgot'

/**
 * Field error text, or nothing. TanStack surfaces Zod issues as `{ message }`.
 *
 * Gated on `touched` because validation runs against the WHOLE object on every
 * keystroke — that is what makes the sign-up password/confirm match check
 * possible. Without the gate, typing a password lights up "Email is required"
 * on a field the person has not reached yet.
 */
const FieldError = ({ errors, touched }: { errors: unknown[]; touched: boolean }) => {
  if (!touched) return null
  const first = errors[0] as { message?: string } | undefined
  if (!first?.message) return null
  return <p className="text-xs text-destructive">{first.message}</p>
}

/**
 * How close a new password is to acceptable.
 *
 * Shows the rules as a checklist rather than a bare "weak/strong" verdict:
 * a meter tells you that you failed, a checklist tells you what to type next.
 */
function PasswordChecklist({ value }: { value: string }) {
  const met = passwordStrength(value)
  const total = PASSWORD_RULES.length

  return (
    <div className="flex flex-col gap-2 pt-0.5">
      <div className="flex gap-1" aria-hidden>
        {PASSWORD_RULES.map((rule, i) => (
          <span
            key={rule.label}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i < met ? 'bg-primary' : 'bg-border'
            )}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value)
          return (
            <li
              key={rule.label}
              className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors duration-150',
                ok ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <Check size={11} className={ok ? 'text-primary' : 'text-muted-foreground/40'} />
              {rule.label}
            </li>
          )
        })}
      </ul>
      <span className="sr-only" aria-live="polite">
        {met} of {total} password requirements met
      </span>
    </div>
  )
}

export interface EmailPasswordFormProps {
  signInCallback: (values: EmailPasswordValues) => Promise<any>
  /**
   * Must resolve the provider's FULL result, not just its error.
   *
   * Whether a session came back is the only way to tell "signed in" from
   * "account created, now go and confirm your email" — swallowing `data` here
   * leaves a successful sign-up with nothing to say.
   */
  signUpCallback: (values: EmailPasswordValues) => Promise<any>
  /** Send a recovery link. Resolves the same way whether or not the address exists. */
  resetCallback: (email: string) => Promise<any>
  /**
   * Which view the form is showing.
   *
   * The host page draws its own "Back" to leave the email form entirely. In the
   * forgot and notice views this component draws one too, and two stacked Backs
   * pointing at different places is worse than either alone — so the page uses
   * this to stand down while the form owns that affordance.
   */
  onViewChange?: (view: FormView) => void
}

export type FormView = AuthMode | 'notice'

/**
 * A terminal state: the form has done its job and is replaced by a message.
 *
 * Both outcomes end in "we sent you an email", but they are NOT the same thing
 * — one confirms a new account, the other recovers an existing one — and the
 * copy has to say which, or the person cannot tell whether their sign-up
 * actually worked.
 */
type Notice =
  | { kind: 'confirm'; email: string }
  | { kind: 'reset'; email: string }

export function EmailPasswordForm({
  signInCallback,
  signUpCallback,
  resetCallback,
  onViewChange,
}: EmailPasswordFormProps) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  // Reported from the handlers that cause it, never from an effect: a
  // render-phase notification would be a setState cascade in the parent.
  const announce = (next: Notice | null, nextMode: AuthMode) =>
    onViewChange?.(next ? 'notice' : nextMode)

  const form = useForm({
    defaultValues: { email: '', password: '', confirmPassword: '' },
    // Validate the whole object so sign-up's password/confirm match check —
    // which needs both values — runs at all. A per-field validator cannot see
    // its sibling.
    validators: {
      onChange:
        mode === 'signUp' ? signUpSchema : mode === 'forgot' ? forgotPasswordSchema : emailPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null)

      if (mode === 'forgot') {
        const { error } = await resetCallback(value.email)
        // Confirm identically whether or not the address is registered —
        // otherwise this endpoint enumerates who has an account.
        if (error) {
          setFormError(error.message)
        } else {
          setNotice({ kind: 'reset', email: value.email })
          announce({ kind: 'reset', email: value.email }, mode)
        }
        return
      }

      if (mode === 'signUp') {
        const { data, error } = await signUpCallback({
          email: value.email,
          password: value.password,
        })
        if (error) {
          setFormError(error.message)
          return
        }

        // Sign-up has TWO successful shapes and they look nothing alike.
        //
        // With email confirmation on, Supabase returns a user and NO session:
        // nothing is signed in, no auth event fires, and without this branch the
        // form simply re-rendered — the "it just flashes" bug. With confirmation
        // off, a session comes back and the page's auth listener navigates, so
        // there is deliberately nothing to do here.
        if (!data?.session) {
          setNotice({ kind: 'confirm', email: value.email })
          announce({ kind: 'confirm', email: value.email }, mode)
        }
        return
      }

      const { error } = await signInCallback({ email: value.email, password: value.password })
      if (error) setFormError(error.message)
    },
  })

  const go = (next: AuthMode) => {
    setMode(next)
    setFormError(null)
    setNotice(null)
    announce(null, next)
    form.reset()
  }

  // The form is replaced rather than left on screen inviting a second submit.
  if (notice) {
    const isConfirm = notice.kind === 'confirm'
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck size={20} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {isConfirm ? 'Confirm your email' : 'Check your inbox'}
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isConfirm ? (
              <>
                Your account is created. We sent a confirmation link to{' '}
                <span className="text-foreground">{notice.email}</span> — open it and you&rsquo;re
                in.
              </>
            ) : (
              <>
                If an account exists for{' '}
                <span className="text-foreground">{notice.email}</span>, a password reset link is
                on its way. The link expires in an hour.
              </>
            )}
          </p>
        </div>
        <Button variant="outline" className="w-full rounded-full" onClick={() => go('signIn')}>
          Back to sign in
        </Button>
      </div>
    )
  }

  const isForgot = mode === 'forgot'
  const isSignUp = mode === 'signUp'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      {isForgot && (
        <div className="mb-1">
          <button
            type="button"
            onClick={() => go('signIn')}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <h3 className="text-base font-semibold text-foreground">Reset your password</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&rsquo;ll send you a link to set a new one.
          </p>
        </div>
      )}

      <form.Field name="email">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
            />
            <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
          </div>
        )}
      </form.Field>

      {!isForgot && (
        <form.Field name="password">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={field.name}>Password</Label>
                {mode === 'signIn' && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
                    onClick={() => go('forgot')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id={field.name}
                name={field.name}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
              />
              {isSignUp ? (
                <PasswordChecklist value={field.state.value} />
              ) : (
                <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
              )}
            </div>
          )}
        </form.Field>
      )}

      {isSignUp && (
        <form.Field name="confirmPassword">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={field.name}>Confirm password</Label>
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
              <FieldError errors={field.state.meta.errors} touched={field.state.meta.isTouched} />
            </div>
          )}
        </form.Field>
      )}

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isForgot ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in'}
          </Button>
        )}
      </form.Subscribe>

      {!isForgot && (
        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => go(isSignUp ? 'signIn' : 'signUp')}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline cursor-pointer"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      )}
    </form>
  )
}
