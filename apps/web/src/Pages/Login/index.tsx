import AuthPage from '@credopass/ui/components/login'
//import { Separator } from '@credopass/ui/components/separator'
import { emailPasswordSchema } from '@credopass/lib/schemas'
import { createAuthClient, createClient } from '@credopass/lib/supabase'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { SUPASE_CRED } from '../../config'
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon'

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
    <div className="gradient-mesh min-h-svh flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full mx-auto bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/50">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
            <CredoPassLogoIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        {view === 'email' && (
          <button onClick={showOptions} className="text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            &larr; Back
          </button>
        )}

        {(view === 'social') && (
          <AuthPage
            signInAsGuest={signInAsGuest}
            signInWithGithub={signInWithGithub}
            signInAsEmail={showEmailForm}
          />
        )}

        {(view === 'email') && (
          <EmailPasswordForm
            signInCallback={(values) => signInWithEmail(values.email, values.password)}
            signUpCallback={(values) => signUpWithEmail(values.email, values.password)}
            schemaValidation={emailPasswordSchema as any}
          />
        )}
      </div>
    </div>
  )
}
