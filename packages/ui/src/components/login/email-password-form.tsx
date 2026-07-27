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

/** Field error text, or nothing. TanStack surfaces Zod issues as `{ message }`. */
const FieldError = ({ errors }: { errors: unknown[] }) => {
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
  signUpCallback: (values: EmailPasswordValues) => Promise<any>
  /** Send a recovery link. Resolves the same way whether or not the address exists. */
  resetCallback: (email: string) => Promise<any>
}

export function EmailPasswordForm({
  signInCallback,
  signUpCallback,
  resetCallback,
}: EmailPasswordFormProps) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [formError, setFormError] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

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
        if (error) setFormError(error.message)
        else setResetSentTo(value.email)
        return
      }

      const callback = mode === 'signIn' ? signInCallback : signUpCallback
      const { error } = await callback({ email: value.email, password: value.password })
      if (error) setFormError(error.message)
    },
  })

  const go = (next: AuthMode) => {
    setMode(next)
    setFormError(null)
    setResetSentTo(null)
    form.reset()
  }

  // Recovery link sent — a terminal state, so the form is replaced rather than
  // left on screen inviting a second submit.
  if (resetSentTo) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck size={20} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Check your inbox</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            If an account exists for <span className="text-foreground">{resetSentTo}</span>, a
            password reset link is on its way. The link expires in an hour.
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
              aria-invalid={field.state.meta.errors.length > 0}
            />
            <FieldError errors={field.state.meta.errors} />
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
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {isSignUp ? (
                <PasswordChecklist value={field.state.value} />
              ) : (
                <FieldError errors={field.state.meta.errors} />
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
                aria-invalid={field.state.meta.errors.length > 0}
              />
              <FieldError errors={field.state.meta.errors} />
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
