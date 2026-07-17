import { Separator } from '../separator'
import { GithubButton } from './github-button'
import { GuestButton } from './guest-button'
import { Button } from '../button'

export function AuthPage({
  signInWithGithub,
  signInAsGuest,
  signInAsEmail,
}: {
  signInWithGithub: () => Promise<any>
  signInAsGuest: () => Promise<any>
  signInAsEmail: () => void
}) {
  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Welcome back</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue</p>
      </div>

      {/* Auth options */}
      <div className="flex flex-col gap-2.5">
        <GithubButton signInWithGithub={signInWithGithub} />

        <div className="my-1 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button variant="outline" type="button" className="w-full" onClick={signInAsEmail}>
          Continue with email
        </Button>

        <GuestButton signInAsGuest={signInAsGuest} />
      </div>
    </div>
  )
}

export default AuthPage
