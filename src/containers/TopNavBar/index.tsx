import React, { useEffect, useCallback } from 'react';
import { 
  Search, 
  Bell, 
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button.js';

import './style.css';
import { useLauncher } from '../../store.js';
import { launchEventForm } from '../EventForm/index.js';
import CommandPalette from './Command';


export const TopNavBar: React.FC = () => {
  const { openLauncher, closeLauncher } = useLauncher();

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
      
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [openCommandPalette]);

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
