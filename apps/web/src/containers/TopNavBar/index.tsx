import React from 'react';

import './style.css';
import SecondaryActionButton from './SecondaryAction';
import ContextualSearch from './ContextualSearch';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { useNavigate, useRouterState } from '@tanstack/react-router';


export const TopNavBar: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className={cn('topbar-container', isMobile && 'topbar-mobile')}>
      {/* Spacer pushes actions to the right */}
      <div className="topbar-spacer" />

      {/* Right actions -- compact */}
      <div className="topbar-actions">
        {!pathname.startsWith('/upgrade') && (
          <UpgradeCTA size="sm" onClick={() => navigate({ to: '/upgrade' })} />
        )}
        {/* Contextual search + secondary action grouped */}
        <ContextualSearch />
        <SecondaryActionButton />
      </div>
    </div>
  );
};
