/**
 * The sign-in panel that sits over the composer on `/events/new` (D21).
 *
 * The funnel this exists for: the marketing site's primary call to action is
 * "Create your first event", it deep-links straight here, and a visitor who has
 * never heard of CredoPass sees the thing they came to use — with the ask laid
 * over it rather than in front of it.
 *
 * **This is presentation, not a security boundary.** The composer behind it is
 * inert because its fields are disabled, and `POST /events` is
 * `scope: 'organization'` and answers 401 without a token. Deleting this element
 * in devtools and re-enabling a field yields a form whose submit is refused by
 * the middleware. Nothing here is load-bearing for authorization, and nothing
 * added here should become so.
 *
 * There is no draft. The fields cannot be typed into before sign-in, so there
 * is nothing to preserve across the OAuth round-trip — which is exactly why the
 * disabled-until-authenticated design is simpler than saving one would be.
 */

import { LogIn } from 'lucide-react'
import AuthPage from '@credopass/ui/components/login'
import { signInWithGoogle } from '../../../supabase'

export function SignInOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/60 p-4 backdrop-blur-md sm:items-center"
      // The composer stays legible behind the glass — that is the whole point —
      // but it is decoration for anyone using a screen reader, who should be
      // taken straight to the thing they must act on.
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to create an event"
    >
      <div className="my-auto w-full max-w-sm rounded-3xl border border-border/60 bg-card/80 p-6 shadow-elevation-3 backdrop-blur-xl">
        <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
          <LogIn size={18} />
        </div>

        {/* Back here, not /events: the visitor came to make THIS event, and the
            composer behind the glass is already holding their place. */}
        <AuthPage
          signInWithGoogle={() => signInWithGoogle('/events/new')}
          title="Welcome to CredoPass"
          subtitle="Sign in to create your event."
        />
      </div>
    </div>
  )
}
