//this hook is temporarily in the ui package, but it should be moved to lib once I figure out the best way to handle cross-package dependencies for hooks that are used in both packages (e.g. usePrevious)
import { useEffect, useState, useCallback, useRef } from 'react';
import CommandPalette from '../containers/Command/index';
import { launchSignInForm } from '../containers/SignInModal/index';
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
                        navigate({ to: '/attendees/new' });
                        break;
                    case 'm':
                        e.preventDefault();
                        navigate({ to: '/attendees' });
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
 * `useGuestAutoLogin` was removed with anonymous sign-in.
 *
 * It signed every first-time visitor in anonymously before they had asked for
 * anything, which created an account row per browser profile, pushed them
 * straight into "create your organization", and left `/events` in the history
 * stack so Back bounced between the two forever. See `packages/lib/src/supabase
 * /auth.ts` for why anonymous sign-in itself is gone.
 */
