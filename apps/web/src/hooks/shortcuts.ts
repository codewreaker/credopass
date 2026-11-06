/**
 * The one shortcut registry.
 *
 * There used to be two: a raw `keydown` listener in `hooks/index.tsx` and a
 * parallel set of `useHotkey('Mod+…')` calls inside the command palette. They
 * disagreed — ⌘P did different things depending on which fired first — and both
 * bound `Mod+` chords that the browser already owns. ⌘V navigated to `/events`
 * instead of pasting, so paste was broken in every input in the product.
 *
 * Two rules come out of that, and they are why this file exists:
 *
 * 1. **Navigation never uses a modifier.** It uses `g` chords — `g` then a
 *    letter — which is what Linear, GitHub and Gmail do and which cannot
 *    collide with anything native. ⌘K stays, because it is the one modifier
 *    shortcut everyone expects, and because it does not shadow a browser
 *    default people rely on.
 * 2. **Every binding lives here.** The palette renders its cheat sheet from
 *    this array rather than hard-coding a second copy of the labels, so a
 *    binding and its documentation cannot drift apart.
 */

export interface ShortcutTarget {
  to: string;
  search?: Record<string, unknown>;
}

export interface Shortcut {
  /** Stable id, used as a React key. */
  id: string;
  /** The letter pressed after `g`. Lower case; matched case-insensitively. */
  key: string;
  /** How the chord is written on screen. */
  display: string;
  label: string;
  group: 'Create' | 'Navigation' | 'Account';
  target: ShortcutTarget;
}

/** The leader key. Press it, then a letter from `SHORTCUTS` within `CHORD_TIMEOUT_MS`. */
export const LEADER_KEY = 'g';

/**
 * How long the leader stays armed. Long enough to be typed deliberately, short
 * enough that a stray `g` cannot swallow the next keystroke a minute later.
 */
export const CHORD_TIMEOUT_MS = 1500;

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: 'new-event',
    key: 'c',
    display: 'G then C',
    label: 'Create event',
    group: 'Create',
    target: { to: '/events/new' },
  },
  {
    id: 'new-attendee',
    key: 'n',
    display: 'G then N',
    label: 'Add attendee',
    group: 'Create',
    target: { to: '/attendees/new' },
  },
  {
    id: 'events',
    key: 'e',
    display: 'G then E',
    label: 'Events',
    group: 'Navigation',
    target: { to: '/events' },
  },
  {
    id: 'attendees',
    key: 'm',
    display: 'G then M',
    label: 'Attendees',
    group: 'Navigation',
    target: { to: '/attendees' },
  },
  {
    id: 'analytics',
    key: 'a',
    display: 'G then A',
    label: 'Analytics',
    group: 'Navigation',
    target: { to: '/analytics' },
  },
  {
    id: 'profile',
    key: 'p',
    display: 'G then P',
    label: 'Profile',
    group: 'Account',
    target: { to: '/account', search: { tab: 'profile' } },
  },
  {
    id: 'organizations',
    key: 'o',
    display: 'G then O',
    label: 'Organizations',
    group: 'Account',
    target: { to: '/account', search: { tab: 'organizations' } },
  },
  {
    id: 'settings',
    key: 's',
    display: 'G then S',
    label: 'Organization settings',
    group: 'Account',
    target: { to: '/account', search: { tab: 'settings' } },
  },
];

/**
 * Is this keystroke someone typing, rather than someone navigating?
 *
 * A global `keydown` listener sees every keystroke in the document, including
 * the ones meant for the field the user is in. Without this guard, `g` chords
 * would eat text the same way the old `Mod+` bindings ate paste.
 *
 * An open dialog counts as typing even when focus is not in a field: a modal is
 * a committed context, and yanking someone out of a half-filled form because
 * they typed `g` is the same bug in a different coat. Base UI unmounts closed
 * dialogs, so the presence of `[role="dialog"]` means one is genuinely open.
 */
export function isTypingContext(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"]')) return true;

  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;

  const role = target.getAttribute('role');
  if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true;

  // A contenteditable host delegates to descendants that are not themselves
  // flagged, so walk up as well as checking the target itself.
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}
