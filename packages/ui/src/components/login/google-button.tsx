import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@credopass/ui/components/button'

/**
 * Google's mark, inline.
 *
 * lucide-react carries no brand glyphs, and Google's terms require the official
 * four-colour G rather than a generic icon — so the paths live here instead of
 * pulling in an icon pack for one asset. `aria-hidden` because the button's own
 * text already names the provider.
 */
function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

/**
 * The only sign-in control in the product.
 *
 * On success the browser leaves for Google, so `signInWithGoogle` only ever
 * resolves here in the FAILURE case — which is why the spinner is not cleared
 * on the happy path. Clearing it would flash the idle button over a page that
 * is already navigating away.
 *
 * A failure goes to `onError` when the caller provides one, so the app can show
 * the full error screen instead of a line of red text under a button. The
 * inline fallback stays for callers that have nowhere to send it.
 */
export function GoogleButton({
  signInWithGoogle,
  onError,
}: {
  // `error` is deliberately `unknown`: the design system does not model the
  // app's auth errors, it just reports that one happened.
  signInWithGoogle: () => Promise<{ error: unknown }>
  onError?: (error: unknown) => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setIsLoading(true)
    setError(null)

    const { error } = await signInWithGoogle()
    if (!error) return

    if (onError) {
      // The caller navigates away; leave the spinner up rather than flashing
      // the idle button during the transition.
      onError(error)
      return
    }

    const message =
      typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Sign-in could not be started.'
    setError(message)
    setIsLoading(false)
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
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
