import React, { useCallback, useEffect, useRef } from 'react';
import {
  Calendar,
  User,
  Settings,
  UserPlus,
  Users,
  ChartNoAxesCombined,
  Database,
  LogIn,
  QrCode,
  Building2,
  Hash,
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

import { launchEventForm } from '../EventForm/index';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';
import type { LauncherState } from '@credopass/lib/stores';
import { useNavigate } from '@tanstack/react-router';

const CommandPalette: React.FC<{
  onClose: () => void;
  openLauncher: ({ content, onClose, onOpen }: Omit<LauncherState, 'isOpen'>) => void;
}> = ({ onClose, openLauncher }) => {
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
    launchEventForm({ isEditing: false }, openLauncher);
  }, [onClose, openLauncher]);

  const handleNewMember = useCallback(() => {
    onClose();
    launchUserForm({ isEditing: false }, openLauncher);
  }, [onClose, openLauncher]);

  const handleSignIn = useCallback(() => {
    onClose();
    launchSignInForm({}, openLauncher);
  }, [onClose, openLauncher]);

  const handleNavigate = useCallback(
    (path: string) => {
      onClose();
      navigate({ to: path });
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
            <CommandShortcut>{'⌘E'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleNewMember} className="command-palette-item">
            <UserPlus className="command-palette-item-icon" />
            <span>Register New Member</span>
            <CommandShortcut>{'⌘N'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleSignIn} className="command-palette-item">
            <LogIn className="command-palette-item-icon" />
            <span>Sign In</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate('/checkin')} className="command-palette-item">
            <QrCode className="command-palette-item-icon" />
            <span>Check-In</span>
            <CommandShortcut>{'⌘I'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/members')} className="command-palette-item">
            <Users className="command-palette-item-icon" />
            <span>Members</span>
            <CommandShortcut>{'⌘M'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/events')} className="command-palette-item">
            <Calendar className="command-palette-item-icon" />
            <span>Events</span>
            <CommandShortcut>{'⌘V'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/analytics')} className="command-palette-item">
            <ChartNoAxesCombined className="command-palette-item-icon" />
            <span>Analytics</span>
            <CommandShortcut>{'⌘A'}</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/organizations')} className="command-palette-item">
            <Building2 className="command-palette-item-icon" />
            <span>Organizations</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/database')} className="command-palette-item">
            <Database className="command-palette-item-icon" />
            <span>Tables</span>
            <CommandShortcut>{'⌘T'}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={handleSignIn} className="command-palette-item">
            <User className="command-palette-item-icon" />
            <span>Profile</span>
            <CommandShortcut>{'⌘P'}</CommandShortcut>
          </CommandItem>
          <CommandItem className="command-palette-item">
            <Settings className="command-palette-item-icon" />
            <span>Settings</span>
            <CommandShortcut>{'⌘S'}</CommandShortcut>
          </CommandItem>
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
