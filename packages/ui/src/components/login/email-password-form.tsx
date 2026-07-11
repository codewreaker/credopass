import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@credopass/ui/components/button'
import { Input } from '@credopass/ui/components/input'
import { Label } from '@credopass/ui/components/label'


export type EmailPasswordValues = { email: string; password: string }
type AuthMode = 'signIn' | 'signUp'

export function EmailPasswordForm({
  signInCallback,
  signUpCallback,
  schemaValidation,
}: {
  signInCallback: (values: EmailPasswordValues) => Promise<any>
  signUpCallback: (values: EmailPasswordValues) => Promise<any>,
  schemaValidation: {
    email: any,
    password: any
  }
}) {
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' } as EmailPasswordValues,
    onSubmit: async ({ value }) => {
      setFormError(null)
      const callback = mode === 'signIn' ? signInCallback : signUpCallback
      const { error } = await callback(value)
      if (error) setFormError(error.message)
    },
  })

  function toggleMode() {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))
    setFormError(null)
    form.reset()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.Field name="email" validators={{ onChange: schemaValidation.email }}>
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
            {field.state.meta.errors[0] && (
              <p className="text-xs text-destructive">{field.state.meta.errors[0].message}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="password" validators={{ onChange: schemaValidation.password }}>
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={field.name}>Password</Label>
              {mode === 'signIn' && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    /* wire up forgot-password flow */
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors[0] && (
              <p className="text-xs text-destructive">{field.state.meta.errors[0].message}</p>
            )}
          </div>
        )}
      </form.Field>

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>
        )}
      </form.Subscribe>

      <p className="text-center text-sm text-muted-foreground">
        {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
        <button
          type="button"
          onClick={toggleMode}
          className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
        >
          {mode === 'signIn' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </form>
  )
}