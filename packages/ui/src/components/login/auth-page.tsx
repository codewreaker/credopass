import { CardDescription, CardHeader, CardTitle } from '@credopass/ui/components/card'
import { Separator } from '@credopass/ui/components/separator'
import type { } from '@credopass/api-client'

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
    <div className="flex-col">
      <CardHeader className="items-center gap-2 px-0 text-center">
        <CardTitle className="text-xl">Welcome to Credopass</CardTitle>
        <CardDescription>Sign in to your account, or continue as a guest</CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-3">
        <GithubButton signInWithGithub={signInWithGithub} />
        <GuestButton signInAsGuest={signInAsGuest} />
      </div>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button type="submit" className="w-full" onClick={signInAsEmail}>
        {'Signin with email'}
      </Button>
    </div>
  )
}