import AuthPage from '@credopass/ui/components/login'
//import { Separator } from '@credopass/ui/components/separator'
import { emailPasswordSchema } from '@credopass/lib/schemas'
import { createAuthClient, createClient } from '@credopass/lib/supabase'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { SUPASE_CRED } from '../../config'
import { Separator } from '@credopass/ui/components/separator'
import { Button } from '@credopass/ui/components/button'



const supabaseInstance = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)

const {
  signInAsGuest,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail
} = createAuthClient(supabaseInstance);

// import { useGuestAutoLogin } from '../../hooks'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useGuestAutoLogin } from '../../hooks'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {

  const { manual, view } = useSearch({ from: '/login' });
  const navigate = useNavigate({ from: '/login' })

  const showEmailForm = () =>
    navigate({
      search: (prev) => ({ ...prev, view: 'email' }),
      replace: true,
    })

  const showOptions = () =>
    navigate({
      search: (prev) => ({ ...prev, view: 'social' }),
      replace: true,
    })

  const isAutoSigningIn = useGuestAutoLogin(manual, supabaseInstance, signInAsGuest)

  if (isAutoSigningIn) {
    return (
      <div className="gradient-mesh relative flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm">Setting up your session…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {(view === 'social') && <AuthPage
        signInAsGuest={signInAsGuest}
        signInWithGithub={signInWithGithub}
        signInAsEmail={showEmailForm}
      />
      }

      {(view === 'email') && (
        <>
          <button onClick={showOptions} className="text-sm text-muted-foreground mb-10">
            ← Back
          </button>
          <EmailPasswordForm
            signInCallback={(values) => signInWithEmail(values.email, values.password)}
            signUpCallback={(values) => signUpWithEmail(values.email, values.password)}
            schemaValidation={emailPasswordSchema as any}
          />
        </>
      )}
    </>

  )
}
