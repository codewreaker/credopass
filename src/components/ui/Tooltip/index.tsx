import React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import './style.css';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
}

// Map position to Base UI side
const positionToSide: Record<TooltipPosition, 'top' | 'bottom' | 'left' | 'right'> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
};

/**
 * Tooltip Component using Base UI
 * 
 * Features:
 * - Uses Base UI Tooltip for accessible tooltip behavior
 * - Supports 4 position variants (top, bottom, left, right)
 * - Auto-adjusts position via collision detection
 * - Configurable delay before showing
 * - Includes styled arrow pointing to target
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
}) => {
  const side = positionToSide[position];

  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          className={`tooltip-container ${className}`}
          render={(props) => (
            <span {...props} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {children}
            </span>
          )}
          delay={delay}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner
            side={side}
            sideOffset={8}
            className="tooltip-positioner"
          >
            <BaseTooltip.Popup className="tooltip">
              {content}
              <BaseTooltip.Arrow className="tooltip-arrow" />
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
};

export default Tooltip;

