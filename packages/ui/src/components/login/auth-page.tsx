import { Separator } from '../separator'
import { GithubButton } from './github-button'
import { Button } from '../button'

export function AuthPage({
  signInWithGithub,
  signInAsEmail,
  title = 'Welcome back',
  subtitle = 'Sign in to your account to continue',
}: {
  signInWithGithub: () => Promise<any>
  signInAsEmail: () => void
  title?: string
  subtitle?: string
}) {
  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Auth options */}
      <div className="flex flex-col gap-2.5">
        <GithubButton signInWithGithub={signInWithGithub} />

        <div className="my-1 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button variant="outline" type="button" className="w-full h-11 rounded-full" onClick={signInAsEmail}>
          Continue with email
        </Button>
      </div>
    </div>
  )
}

export default AuthPage
