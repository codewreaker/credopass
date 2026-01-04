import React, { useEffect, useCallback } from 'react';
import { 
  Search, 
  Bell, 
  Calendar, 
  User, 
  Settings, 
  UserPlus,
  LayoutDashboard,
  Users,
  ChartNoAxesCombined,
  Database,
  LogIn
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command.js';
import './style.css';
import { useLauncher } from '../../store.js';
import { launchEventForm } from '../EventForm/index.js';
import { launchUserForm } from '../UserForm/index.js';
import { launchSignInForm } from '../SignInModal/index.js';

// Command Palette Component
const CommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { openLauncher } = useLauncher();
  const navigate = useNavigate();

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

  const handleNavigate = useCallback((path: string) => {
    onClose();
    navigate({ to: path });
  }, [onClose, navigate]);

  return (
    <Command className="rounded-lg border shadow-md w-full max-w-2xl">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={handleNewEvent}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>New Event</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleNewMember}>
            <UserPlus className="mr-2 h-4 w-4" />
            <span>Register New Member</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate('/')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Home</span>
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/members')}>
            <Users className="mr-2 h-4 w-4" />
            <span>Members</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/events')}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Events</span>
            <CommandShortcut>⌘V</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/analytics')}>
            <ChartNoAxesCombined className="mr-2 h-4 w-4" />
            <span>Analytics</span>
            <CommandShortcut>⌘A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate('/database')}>
            <Database className="mr-2 h-4 w-4" />
            <span>Tables</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={handleSignIn}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={handleSignIn}>
            <LogIn className="mr-2 h-4 w-4" />
            <span>Sign In</span>
          </CommandItem>
          <CommandItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();
  const navigate = useNavigate();

  // Open command palette via launcher
  const openCommandPalette = useCallback(() => {
    openLauncher({
      content: <CommandPalette onClose={closeLauncher} />,
      onClose: closeLauncher,
    });
  }, [openLauncher, closeLauncher]);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      
      // Direct shortcuts (only when no modals are open)
      if ((e.metaKey || e.ctrlKey)) {
        switch (e.key) {
          case 'e':
            e.preventDefault();
            launchEventForm({ isEditing: false }, openLauncher);
            break;
          case 'n':
            e.preventDefault();
            launchUserForm({ isEditing: false }, openLauncher);
            break;
          case 'h':
            e.preventDefault();
            navigate({ to: '/' });
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
            navigate({ to: '/database' });
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
  }, [openCommandPalette, openLauncher, navigate]);

  // Quick action handlers
  const handleNewEvent = useCallback(() => {
    launchEventForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  return (
    <div className="top-navbar">
      <div className="navbar-left">
        <Button
          variant="outline"
          className="search-container"
          onClick={openCommandPalette}
        >
          <Search className="search-icon" size={14} />
          <span className="search-input">Search or run a command...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <div className="navbar-right">
        <Button variant="default" onClick={handleNewEvent}>
          <Calendar size={14} />
          New Event
        </Button>

        <Button variant="ghost" size="icon" className="notification-btn">
          <Bell size={15} />
          <span className="notification-badge">3</span>
        </Button>
      </div>
    </div>
  );
};
