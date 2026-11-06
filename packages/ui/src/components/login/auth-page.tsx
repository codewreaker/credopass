import { GoogleButton } from './google-button'

/**
 * The sign-in panel. One provider, so there is no "or" divider and no second
 * path to choose between — the whole screen is a single button.
 */
export function AuthPage({
  signInWithGoogle,
  onError,
  title = 'Welcome back',
  subtitle = 'Sign in to your account to continue',
}: {
  signInWithGoogle: () => Promise<{ error: unknown }>
  onError?: (error: unknown) => void
  title?: string
  subtitle?: string
}) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <GoogleButton signInWithGoogle={signInWithGoogle} onError={onError} />
    </div>
  )
}

export default AuthPage
