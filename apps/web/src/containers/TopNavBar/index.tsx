import React, { useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Calendar,
  User as UserIcon
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


export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Open command palette via launcher
  const openCommandPalette = useCallback(() => {
    openLauncher({
      content: <CommandPalette onClose={closeLauncher} openLauncher={openLauncher} />,
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
  }, [openCommandPalette, openLauncher, navigate]);

  // Quick action handlers
  const handleNewEvent = useCallback(() => {
    launchEventForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  return (
    <div className={cn(
      "flex items-center px-4 justify-between",
      isMobile ? "w-10/12" : "w-full"
    )}>
      <div className={cn("navbar-left", isMobile ? "p-0 w-4/10" : "w-full p-5")} ref={searchButtonRef as unknown as React.RefObject<HTMLDivElement>}>
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

      {<div className="navbar-right flex items-center gap-2">
        <Button variant="default" onClick={handleNewEvent}>
          <Calendar />
          {!isMobile && "New Event"}
        </Button>


        <div className="top-navbar-btn">
          {/* <User size={15} /> */}
          <UserComponent user={{
            name: "shadcn",
            email: "m@example.com",
            avatar: "/avatars/shadcn.jpg",
            icon: UserIcon
          }} />
          <Badge>3</Badge>
        </div>

      </div>}
    </div>
  );
};
