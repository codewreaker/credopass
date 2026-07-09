import AuthPage from '@credopass/ui/components/login'
//import { Separator } from '@credopass/ui/components/separator'
import { EmailPasswordForm } from './email-password-form'
import { createAuthClient, createClient } from '@credopass/lib/supabase'
import { SUPASE_CRED } from '../../config'

const supabaseInstance = createClient(SUPASE_CRED.URL, SUPASE_CRED.ANON_KEY)

const {
  signInAsGuest,
  signInWithEmail,
  signInWithGithub,
  signUpWithEmail
} = createAuthClient(supabaseInstance);

// import { useGuestAutoLogin } from '../../hooks'
// import { useSearch } from '@tanstack/react-router'

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

export default function LoginPage() {


  return (
    <AuthPage signInAsGuest={signInAsGuest} signInWithGithub={signInWithGithub}>
      <EmailPasswordForm signInCallback={signInWithEmail} signUpCallback={signUpWithEmail} />
    </AuthPage>
  )
}
