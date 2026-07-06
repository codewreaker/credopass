import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'

import { Button } from '@credopass/ui/components/button'
import { Input } from '@credopass/ui/components/input'
import { Label } from '@credopass/ui/components/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@credopass/ui/components/tabs'

import { emailPasswordSchema } from '@credopass/lib/schemas'

type Mode = 'sign-in' | 'sign-up'

type SignInCallbackResult = {
  error: Error,
  data: {
    session: string,
  }
}

const defaultResolver = (email: string, _password?: string) => (new Promise((res, rej) => {
  rej(`
      Can't sign you in: ${email}. You need to provide a handler for Email Password\
      form. Path /ui/src/components/login/email-password-form.tsx
      `)
}));

export function EmailPasswordForm({
  signInCallback = defaultResolver,
  signUpCallback = defaultResolver
}: {
  signInCallback?: (email: string, password: string) => Promise<SignInCallbackResult>,
  signUpCallback?: (email: string, password: string) => Promise<SignInCallbackResult>
}) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setFormError(null)
      setConfirmationSent(false)

      const result = emailPasswordSchema.safeParse(value)
      if (!result.success) return

      const { error, data } =
        mode === 'sign-in'
          ? await signInCallback(result.data.email, result.data.password)
          : await signUpCallback(result.data.email, result.data.password)

      if (error) {
        setFormError(error.message)
        return
      }

      // With email confirmation enabled, sign-up succeeds without a
      // session until the person clicks the confirmation link.
      if (mode === 'sign-up' && !data.session) {
        setConfirmationSent(true)
        return
      }

      window.location.assign('/events')
    },
  })

  function renderFields(submitLabel: string) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) =>
              emailPasswordSchema.shape.email.safeParse(value).success
                ? undefined
                : 'Enter a valid email address',
          }}
        >
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
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-xs text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) =>
              emailPasswordSchema.shape.password.safeParse(value).success
                ? undefined
                : 'Must be at least 8 characters',
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={field.name}>Password</Label>
                {mode === 'sign-in' && (
                  <a
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete={
                  mode === 'sign-in' ? 'current-password' : 'new-password'
                }
                placeholder="••••••••"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-xs text-destructive">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {formError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        {confirmationSent && (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            Check your inbox to confirm your email address.
          </p>
        )}

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="mt-1">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </form>
    )
  }

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        setMode(value as Mode)
        setFormError(null)
        setConfirmationSent(false)
      }}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="sign-in">Sign in</TabsTrigger>
        <TabsTrigger value="sign-up">Create account</TabsTrigger>
      </TabsList>

      <TabsContent value="sign-in" className="mt-5">
        {renderFields('Sign in')}
      </TabsContent>
      <TabsContent value="sign-up" className="mt-5">
        {renderFields('Create account')}
      </TabsContent>
    </Tabs>
  )
}
