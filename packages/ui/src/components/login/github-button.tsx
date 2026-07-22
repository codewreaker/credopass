import { useState } from 'react'
import { Github, Loader2 } from 'lucide-react'

import { Button } from '@credopass/ui/components/button'


export function GithubButton({
  signInWithGithub
}: {
  signInWithGithub: () => Promise<any>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setIsLoading(true)
    setError(null)

    const { error } = await signInWithGithub()

    // On success the browser is redirected to GitHub, so this only
    // resolves in the error case.
    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="default"
        className="w-full h-11 rounded-full font-semibold"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Github className="size-4" />
        )}
        Continue with GitHub
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
