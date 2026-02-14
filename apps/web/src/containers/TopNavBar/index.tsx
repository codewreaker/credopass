import React, { useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Bell,
  Plus,
} from 'lucide-react';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';

import './style.css';
import { useLauncher } from '../../stores/store';
import { launchEventForm } from '../EventForm/index';
import CommandPalette from './Command';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@credopass/ui/components/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@credopass/ui/components/avatar';


export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const openCommandPalette = useCallback(() => {
    openLauncher({
      content: <CommandPalette onClose={closeLauncher} openLauncher={openLauncher} />,
      onClose: closeLauncher,
    });
  }, [openLauncher, closeLauncher]);

  // Keyboard shortcuts - stable ref pattern
  const shortcutsRef = useRef({ openCommandPalette, openLauncher, navigate });
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
            launchEventForm({ isEditing: false }, openLauncher);
            break;
          case 'n':
            e.preventDefault();
            launchUserForm({ isEditing: false }, openLauncher);
            break;
          case 'h':
            e.preventDefault();
            navigate({ to: '/dashboard' });
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
  }, []);

  return (
    <div className={cn('topbar-container', isMobile && 'topbar-mobile')}>
      {/* Search trigger -- centered, clean */}
      <button
        type="button"
        className="search-trigger"
        onClick={openCommandPalette}
        aria-label="Open command palette"
      >
        <Search className="search-icon" size={14} />
        <span className="search-placeholder">
          {isMobile ? 'Search...' : 'Search or run a command...'}
        </span>
        {!isMobile && (
          <kbd className="search-kbd">
            <span className="text-xs">{'⌘'}</span>K
          </kbd>
        )}
      </button>

      {/* Right actions -- compact */}
      <div className="topbar-actions">
        {/* Plus button -- opens command palette (like Luma's + button) */}
        <button
          type="button"
          className="topbar-plus-btn"
          onClick={openCommandPalette}
          aria-label="Quick actions"
        >
          <Plus size={16} strokeWidth={2} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="topbar-icon-btn"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="topbar-notification-dot" />
        </button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="topbar-avatar-btn" aria-label="User menu">
              <Avatar className="topbar-avatar">
                <AvatarImage src="/avatars/shadcn.jpg" alt="Israel" />
                <AvatarFallback className="topbar-avatar-fallback">IA</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-none">Israel</p>
                <p className="text-xs text-muted-foreground leading-none">iz@credopass.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => launchSignInForm({}, openLauncher)}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Help & Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
