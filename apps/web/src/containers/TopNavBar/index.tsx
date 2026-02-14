import React, { useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Calendar,
  User as UserIcon,
  Bell,
} from 'lucide-react';
import { Button, Badge } from '@credopass/ui';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';

import './style.css';
import { useLauncher } from '../../stores/store';
import { launchEventForm } from '../EventForm/index';
import CommandPalette from './Command';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import UserComponent from '../../components/user';
import { useDefaultUserMenu } from '../../components/user/default-menu';


export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuGroups = useDefaultUserMenu();

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

  const handleNewEvent = useCallback(() => {
    launchEventForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  return (
    <div className={cn(
      "flex items-center justify-between flex-1",
      isMobile ? "px-2" : "px-4"
    )}>
      {/* Search trigger */}
      <div
        className={cn("navbar-search-wrapper", isMobile ? "w-3/5" : "w-3/5 max-w-md")}
        ref={searchButtonRef as unknown as React.RefObject<HTMLDivElement>}
      >
        <Button
          variant="outline"
          className="search-trigger"
          onClick={openCommandPalette}
        >
          <Search className="search-icon" size={14} />
          <span className="search-placeholder">
            {isMobile ? "Search..." : "Search or run a command..."}
          </span>
          {!isMobile && (
            <kbd className="search-kbd">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          )}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size={isMobile ? "icon" : "default"}
          onClick={handleNewEvent}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm"
        >
          <Calendar size={16} />
          {!isMobile && <span>New Event</span>}
        </Button>

        <div className="top-navbar-btn relative">
          <UserComponent
            user={{
              name: "israel",
              email: "iz@credopass.com",
              avatar: "/avatars/shadcn.jpg",
              icon: UserIcon
            }}
            menuGroups={userMenuGroups}
          />
          <Badge className="notification-badge">3</Badge>
        </div>
      </div>
    </div>
  );
};
