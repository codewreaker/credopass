import React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import './menu.css';

export interface MenuItemConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItemConfig[];
  className?: string;
}

/**
 * Menu Component using Base UI
 * 
 * A dropdown menu component that maintains the application's design system.
 * Supports icons, dividers, and disabled states.
 */
export const Menu: React.FC<MenuProps> = ({ trigger, items, className = '' }) => {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger className={`menu-trigger ${className}`}>
        {trigger}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner side="bottom" align="end" sideOffset={6}>
          <BaseMenu.Popup className="menu-popup">
            {items.map((item, index) => {
              if (item.divider) {
                return <BaseMenu.Separator key={`divider-${index}`} className="menu-divider" />;
              }
              return (
                <BaseMenu.Item
                  key={item.id}
                  className="menu-item"
                  onClick={item.onClick}
                  disabled={item.disabled}
                >
                  {item.icon && <span className="menu-item-icon">{item.icon}</span>}
                  <span className="menu-item-label">{item.label}</span>
                </BaseMenu.Item>
              );
            })}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
};

// Re-export Base UI Menu parts for custom composition
export { BaseMenu as MenuRoot };

export default Menu;
