import React from 'react';
import { Button } from '@credopass/ui';
import type { MenuItem } from './index';

export interface BulkActionItem {
  key: string;
  label: string;
  icon?: React.ReactElement;
  action: (selectedItems: any[], gridId?: string) => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

interface HeaderProps {
  title?: string;
  subtitle?: string;
  menu?: MenuItem[];
  loading?: boolean;
  selectedItems?: any[];
  bulkActions?: BulkActionItem[];
  gridId?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  menu = [],
  loading = false,
  selectedItems = [],
  bulkActions = [],
  gridId,
}) => {
  const showHeader = title || menu.length > 0 || selectedItems.length > 0;

  if (!showHeader) return null;

  return (
    <div className="table-header">
      {
        title && (
          <div className="title-section">
            <h2>{title}</h2>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
        )
      }

      <div className="actions">
        {(selectedItems.length > 0 && bulkActions.length > 0) && (
          <>
            {bulkActions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant || "secondary"}
                size='sm'
                onClick={() => action.action(selectedItems, gridId)}
              >
                {action.icon}
                {`${action.label} (${selectedItems.length})`}
              </Button>
            ))}
          </>)
        }
        {menu.length > 0 && menu.map((item) => {
          const isRefreshing = loading && item.id === 'refresh';

          return (
            <Button
              key={item.id}
              variant="secondary"
              size='sm'
              onClick={item.action}
              disabled={item.disabled || loading}
            >
              <span className={isRefreshing ? 'spinning' : ''}>
                {item.icon}
              </span>
              {item.label}
            </Button>
          );
        })
        }
      </div>
    </div>
  );
};

export default Header;