//this hook is temporarily in the ui package, but it should be moved to lib once I figure out the best way to handle cross-package dependencies for hooks that are used in both packages (e.g. usePrevious)
import { useEffect, useState, useCallback, useRef } from 'react';
import CommandPalette from '../containers/Command/index';
import { launchSignInForm } from '../containers/SignInModal/index';
import { launchUserForm } from '../containers/UserForm/index';
import { useNavigate } from '@tanstack/react-router';
import { useLauncher } from '@credopass/lib/stores';



export const useCommandPallete = () => {
    const { openLauncher, closeLauncher } = useLauncher();
    const navigate = useNavigate();

    const openCommandPalette = useCallback(() => {
        openLauncher({
            content: <CommandPalette onClose={closeLauncher} openLauncher={openLauncher} />,
            onClose: closeLauncher,
        });
    }, [openLauncher, closeLauncher]);

    // Keyboard shortcuts - stable ref pattern (advanced-event-handler-refs)
    const shortcutsRef = useRef({ openCommandPalette, openLauncher, navigate });
    //@todo look into this
    // eslint-disable-next-line react-hooks/refs
    shortcutsRef.current = { openCommandPalette, openLauncher, navigate };

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            const { openCommandPalette, openLauncher, navigate } = shortcutsRef.current;

            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                openCommandPalette();
                return;
            }

            if (e.metaKey || e.ctrlKey) {
                switch (e.key) {
                    case 'e':
                        e.preventDefault();
                        navigate({ to: '/events/new' });
                        break;
                    case 'n':
                        e.preventDefault();
                        launchUserForm({ isEditing: false }, openLauncher);
                        break;
                    case 'm':
                        e.preventDefault();
                        navigate({ to: '/members' });
                        break;
                    case 'v':
                        e.preventDefault();
                        navigate({ to: '/events' });
                        break;
                    case 'a':
                        e.preventDefault();
                        navigate({ to: '/analytics' });
                        break;
                    case 't':
                        e.preventDefault();
                        navigate({ to: '/organizations' });
                        break;
                    case 'p':
                        e.preventDefault();
                        launchSignInForm({}, openLauncher);
                        break;
                }
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return {
        openCommandPalette
    }
}

/**
 * Guest login is the default experience: a visitor who lands on `/login`
 * without explicitly asking to sign in (no `?manual=true`) is signed in
 * anonymously right away and never sees the form.
 *
 * Anyone who navigates here on purpose — e.g. a "Log in" link that sets
 * `?manual=true` — skips the auto sign-in and sees the full page, which
 * still exposes "Continue as guest" as an explicit button.
 */
export function useGuestAutoLogin(manual: boolean, supabase:any, signInAsGuest:any) {
  const [isAutoSigningIn, setIsAutoSigningIn] = useState(!manual)
  const navigate = useNavigate()
  const hasRun = useRef(false)

  useEffect(() => {
    if (manual || hasRun.current) return
    hasRun.current = true

    // No `cancelled` cleanup flag here on purpose: `hasRun` already
    // guarantees a single execution, and under React StrictMode the
    // dev-only unmount/remount cycle would flip a cleanup flag and
    // permanently suppress the post-await navigation.
    async function run() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate({ to: '/events' })
        return
      }

      const { error } = await signInAsGuest()

      if (error) {
        // Fall back to showing the real page so the person isn't stuck
        // on a spinner if anonymous sign-in is disabled or fails.
        setIsAutoSigningIn(false)
        return
      }

      navigate({ to: '/events' })
    }

    run()
  }, [manual, navigate])

  return isAutoSigningIn
}
