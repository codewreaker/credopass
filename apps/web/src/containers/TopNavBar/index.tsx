import React, { useEffect, useCallback, useRef } from 'react';
import {
  Plus,
} from 'lucide-react';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';

import './style.css';
import { useLauncher } from '../../stores/store';
import { launchEventForm } from '../EventForm/index';
import CommandPalette from './Command';
import SecondaryActionButton from './SecondaryAction';
import ContextualSearch from './ContextualSearch';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';


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

  // Keyboard shortcuts - stable ref pattern (advanced-event-handler-refs)
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
      {/* Plus button -- opens command palette */}
      <button
        type="button"
        className="topbar-plus-btn"
        onClick={openCommandPalette}
        aria-label="Quick actions"
        title="Command palette (⌘K)"
      >
        <Plus size={16} strokeWidth={2} />
      </button>
      {/* Spacer pushes actions to the right */}
      <div className="topbar-spacer" />

      {/* Right actions -- compact */}
      <div className="topbar-actions">
        {/* Contextual search + secondary action grouped */}
        <ContextualSearch />
        <SecondaryActionButton />

      </div>
    </div>
  );
};
