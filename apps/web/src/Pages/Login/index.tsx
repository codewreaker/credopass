import { Loader2 } from 'lucide-react'

import { Separator } from '@credopass/ui/components/separator'

import { AuthCardShell } from '@credopass/ui/components/login/auth-card-shell'
import { EmailPasswordForm } from '@credopass/ui/components/login/email-password-form'
import { GithubButton } from '@credopass/ui/components/login/github-button'
import { GuestButton } from '@credopass/ui/components/login/guest-button'
// import { useGuestAutoLogin } from '../../hooks'
// import { useSearch } from '@tanstack/react-router'
import {createAuthClient, createClient} from '@credopass/lib/supabase'
import { SUPASE_CRED } from '../../config'

const supabaseInstance = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)

const {
  signInAsGuest,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail
} = createAuthClient(supabaseInstance);

export default function LoginPage() {
  // const { manual } = useSearch({from: '/login'})
  // const isAutoSigningIn = useGuestAutoLogin(manual, supabaseInstance, signInAsGuest)

  // if (isAutoSigningIn) {
  //   return (
  //     <div className="gradient-mesh relative flex min-h-svh items-center justify-center bg-background">
  //       <div className="flex flex-col items-center gap-3 text-muted-foreground">
  //         <Loader2 className="size-6 animate-spin text-primary" />
  //         <p className="text-sm">Setting up your session…</p>
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="gradient-mesh relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <AuthCardShell>
        <EmailPasswordForm signInCallback={signInWithEmail} signUpCallback={signUpWithEmail} />

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            or
          </span>
          <Separator className="flex-1" />
        </div>

        <div className="flex flex-col gap-3">
          <GithubButton signInWithGithub={signInWithGithub} />
          <GuestButton signInAsGuest={signInAsGuest} />
        </div>
      </AuthCardShell>
    </div>
  )
}
