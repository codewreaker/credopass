import React from 'react';

import './style.css';
import SecondaryActionButton from './SecondaryAction';
import ContextualSearch from './ContextualSearch';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';


export const TopNavBar: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div className={cn('topbar-container', isMobile && 'topbar-mobile')}>
      {/* Spacer pushes actions to the right */}
      <div className="topbar-spacer" />

      {/* Right actions -- compact. The upgrade prompt lives in the page flow
          (see the events list) rather than in the chrome. */}
      <div className="topbar-actions">
        {/* Contextual search + secondary action grouped */}
        <ContextualSearch />
        <SecondaryActionButton />
      </div>
    </div>
  );
};
