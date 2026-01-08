import React, { useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Bell,
  Calendar
} from 'lucide-react';
import { Button } from '@dwellpass/ui';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';

import './style.css';
import { useLauncher } from '../../stores/store';
import { launchEventForm } from '../EventForm/index';
import CommandPalette from './Command';
import { useNavigate } from '@tanstack/react-router';


export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();
  const navigate = useNavigate();
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Open command palette via launcher
  const openCommandPalette = useCallback(() => {
    const width = searchButtonRef.current?.offsetWidth || 0;
    console.log('Opening command palette with width:', searchButtonRef.current?.offsetWidth, searchButtonRef.current?.clientWidth);
    openLauncher({
      content: <CommandPalette onClose={closeLauncher} openLauncher={openLauncher} width={width} />,
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
      <div className="navbar-left" ref={searchButtonRef as unknown as React.RefObject<HTMLDivElement>}>
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
