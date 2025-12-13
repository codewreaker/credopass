import React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import './style.css';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
}

/**
 * Simple Tooltip Component
 * 
 * Usage:
 * <Tooltip content="Hello!" position="top">
 *   <button>Hover me</button>
 * </Tooltip>
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
}) => {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root delay={delay}>
        <BaseTooltip.Trigger render={<span className="tooltip-trigger">{children}</span>} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={position} sideOffset={6}>
            <BaseTooltip.Popup className="tooltip-popup">
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
};

export default Tooltip;

