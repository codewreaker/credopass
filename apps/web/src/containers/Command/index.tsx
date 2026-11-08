import React, { useCallback, useEffect, useRef } from 'react';
import {
  Calendar,
  User,
  Settings,
  UserPlus,
  Users,
  ChartNoAxesCombined,
  LogIn,
  UserRound,
  Hash,
  Keyboard,
} from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@credopass/ui/components/command';

import { useNavigate } from '@tanstack/react-router';
import { SHORTCUTS, type Shortcut } from '../../hooks/shortcuts';
import type { AccountTab } from '../../Pages/Account';

/**
 * The palette does not bind any keys.
 *
 * It used to register nine `useHotkey('Mod+…')` handlers that duplicated — and
 * disagreed with — the global listener in `hooks/index.tsx`. Both are gone;
 * `hooks/shortcuts.ts` is the single registry, and this component reads the
 * labels off it so the cheat sheet cannot drift from the bindings.
 */
const shortcutByItem = (id: string): string =>
  SHORTCUTS.find((shortcut: Shortcut) => shortcut.id === id)?.display ?? '';

const CommandPalette: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = document.querySelector('[data-slot="command-input"]') as HTMLInputElement;
      input?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleNewEvent = useCallback(() => {
    onClose();
    navigate({ to: '/events/new' });
  }, [onClose, navigate]);

  const handleNewMember = useCallback(() => {
    onClose();
    navigate({ to: '/attendees/new' });
  }, [onClose, navigate]);

  // Sign-in is a route, not a modal. The modal this replaced never called
  // Supabase at all — it validated the fields and console.logged them.
  const handleSignIn = useCallback(() => {
    onClose();
    navigate({ to: '/login' });
  }, [onClose, navigate]);

  const handleNavigate = useCallback(
    (path: string) => {
      onClose();
      navigate({ to: path });
    },
    [onClose, navigate]
  );

  // `/account` is three screens behind one route, so its entries carry the tab.
  //
  // `AccountTab`, not `string`: the route validates `tab` against a closed
  // set, so a typo here is a search param the route silently falls back from
  // rather than the screen the palette entry promised.
  const handleAccountTab = useCallback(
    (tab: AccountTab) => {
      onClose();
      navigate({ to: '/account', search: { tab } });
    },
    [onClose, navigate]
  );

  return (
    <Command className="command-palette" label="Command Palette">
      <CommandInput placeholder="Type a command or search..." />

      <CommandList ref={listRef} className="command-palette-list">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Hash className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results found.</p>
            <p className="text-xs text-muted-foreground/60">Try a different search term</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={handleNewEvent} className="command-palette-item">
            <Calendar className="command-palette-item-icon" />
            <span>New Event</span>
            <CommandShortcut>{shortcutByItem('new-event')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleNewMember} className="command-palette-item">
            <UserPlus className="command-palette-item-icon" />
            <span>Add Attendee</span>
            <CommandShortcut>{shortcutByItem('new-attendee')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleSignIn} className="command-palette-item">
            <LogIn className="command-palette-item-icon" />
            <span>Sign In</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/*
          There was a "Check-In" entry here that navigated to `/events`. The real
          kiosk route is `/checkin/$eventId` and the palette has no event in
          hand, so the entry was a second, mislabelled way to reach the events
          list. Removed rather than relabelled.
        */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate('/events')} className="command-palette-item">
            <Calendar className="command-palette-item-icon" />
            <span>Events</span>
            <CommandShortcut>{shortcutByItem('events')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/attendees')} className="command-palette-item">
            <Users className="command-palette-item-icon" />
            <span>Attendees</span>
            <CommandShortcut>{shortcutByItem('attendees')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/analytics')} className="command-palette-item">
            <ChartNoAxesCombined className="command-palette-item-icon" />
            <span>Analytics</span>
            <CommandShortcut>{shortcutByItem('analytics')}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={() => handleAccountTab('profile')} className="command-palette-item">
            <User className="command-palette-item-icon" />
            <span>Profile</span>
            <CommandShortcut>{shortcutByItem('profile')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAccountTab('organizations')} className="command-palette-item">
            <UserRound className="command-palette-item-icon" />
            <span>Organizations</span>
            <CommandShortcut>{shortcutByItem('organizations')}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleAccountTab('settings')} className="command-palette-item">
            <Settings className="command-palette-item-icon" />
            <span>Organization Settings</span>
            <CommandShortcut>{shortcutByItem('settings')}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/*
          The cheat sheet. The bindings changed from ⌘-letters to `g` chords, so
          there has to be somewhere that says what they are now — and the palette
          is where someone looks when they are hunting for a command anyway.
        */}
        <CommandGroup heading="Keyboard Shortcuts">
          <CommandItem className="command-palette-item" disabled>
            <Keyboard className="command-palette-item-icon" />
            <span>Open this palette</span>
            <CommandShortcut>{'⌘K'}</CommandShortcut>
          </CommandItem>
          {SHORTCUTS.map((shortcut) => (
            <CommandItem key={shortcut.id} className="command-palette-item" disabled>
              <Keyboard className="command-palette-item-icon" />
              <span>{shortcut.label}</span>
              <CommandShortcut>{shortcut.display}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      {/* Footer hint */}
      <div className="command-palette-footer">
        <div className="command-palette-footer-hints">
          <span className="command-palette-hint">
            <kbd className="command-palette-kbd">{'↑'}</kbd>
            <kbd className="command-palette-kbd">{'↓'}</kbd>
            <span>navigate</span>
          </span>
          <span className="command-palette-hint">
            <kbd className="command-palette-kbd">{'↵'}</kbd>
            <span>select</span>
          </span>
          <span className="command-palette-hint">
            <kbd className="command-palette-kbd">esc</kbd>
            <span>close</span>
          </span>
        </div>
      </div>
    </Command>
  );
};

export default CommandPalette;
