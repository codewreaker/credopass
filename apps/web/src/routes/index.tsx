import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../supabase'

/**
 * `/` is a signpost, not a page.
 *
 * It asks whether there is a session and sends the person to the app or to
 * sign-in accordingly. Deciding HERE — in `beforeLoad`, before anything renders
 * — is what keeps it to a single hop. The previous version redirected
 * unconditionally to `/login`, which then bounced signed-in visitors onward to
 * `/events`: two navigations to reach a destination already knowable.
 *
 * `getSession` reads local storage rather than the network, so this does not
 * delay first paint. A failure falls through to `/login`, which is the safe
 * direction: the worst case is asking someone to sign in again, never showing
 * the console to someone who is not signed in.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    let signedIn = false
    try {
      const { data } = await supabase.auth.getSession()
      signedIn = !!data.session
    } catch {
      signedIn = false
    }

    if (signedIn) throw redirect({ to: '/events', replace: true })
    throw redirect({ to: '/login', search: { view: 'social' }, replace: true })
  },
})
