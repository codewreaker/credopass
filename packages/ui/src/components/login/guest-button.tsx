import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { Button } from '@credopass/ui/components/button'

import { signInAsGuest } from '../-lib/auth'

export function GuestButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleClick() {
    setIsLoading(true)
    setError(null)

    const { error } = await signInAsGuest()

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    navigate({ to: '/dashboard' })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground hover:text-foreground"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="size-4 animate-spin" />}
        Continue as guest
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
