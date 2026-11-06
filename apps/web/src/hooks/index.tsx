//this hook is temporarily in the ui package, but it should be moved to lib once I figure out the best way to handle cross-package dependencies for hooks that are used in both packages (e.g. usePrevious)
import { useEffect, useCallback, useRef } from 'react';
import CommandPalette from '../containers/Command/index';
import { useNavigate } from '@tanstack/react-router';
import { useLauncher } from '@credopass/lib/stores';
import { CHORD_TIMEOUT_MS, LEADER_KEY, SHORTCUTS, isTypingContext } from './shortcuts';

/**
 * ⌘K opens the palette; `g`-chords navigate. Nothing else is bound globally.
 *
 * See `./shortcuts.ts` for why — in short, the previous version bound seven
 * `Mod+` letters with no focus guard, which broke paste, select-all, new tab,
 * new window and print across the whole app.
 */
export const useCommandPallete = () => {
    const { openLauncher, closeLauncher } = useLauncher();
    const navigate = useNavigate();

    const openCommandPalette = useCallback(() => {
        openLauncher({
            content: <CommandPalette onClose={closeLauncher} />,
            onClose: closeLauncher,
        });
    }, [openLauncher, closeLauncher]);

    // Keyboard shortcuts - stable ref pattern (advanced-event-handler-refs)
    const shortcutsRef = useRef({ openCommandPalette, navigate });
    //@todo look into this
    // eslint-disable-next-line react-hooks/refs
    shortcutsRef.current = { openCommandPalette, navigate };

    useEffect(() => {
        // Whether `g` was the last key pressed, and when. The chord is held in a
        // closure rather than state: it changes on every keystroke and nothing
        // renders from it.
        let leaderArmedAt = 0;

        const down = (e: KeyboardEvent) => {
            const { openCommandPalette, navigate } = shortcutsRef.current;

            // ⌘K is the one modifier binding that survives. It is expected
            // everywhere, including from inside a text field, so it is checked
            // before the typing guard.
            if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey) {
                e.preventDefault();
                leaderArmedAt = 0;
                openCommandPalette();
                return;
            }

            // Hands off anything the browser or the OS owns. Navigation does not
            // use modifiers any more, so a modifier here is never ours.
            if (e.metaKey || e.ctrlKey || e.altKey) {
                leaderArmedAt = 0;
                return;
            }

            if (isTypingContext(e.target)) {
                leaderArmedAt = 0;
                return;
            }

            const key = e.key.toLowerCase();

            if (leaderArmedAt && Date.now() - leaderArmedAt <= CHORD_TIMEOUT_MS) {
                leaderArmedAt = 0;
                const match = SHORTCUTS.find((shortcut) => shortcut.key === key);
                if (match) {
                    e.preventDefault();
                    navigate({ to: match.target.to, search: match.target.search });
                }
                return;
            }

            leaderArmedAt = key === LEADER_KEY ? Date.now() : 0;
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return {
        openCommandPalette
    }
}
