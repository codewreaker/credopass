import React from 'react';
import { Button } from '../ui/button.js';
import type { MenuItem } from './index.js';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  menu?: MenuItem[];
  loading?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  menu = [],
  loading = false,
}) => {
  const showHeader = title || menu.length > 0;

  if (!showHeader) return null;

  return (
    <div className="table-header">
      {title && (
        <div className="title-section">
          <h2>{title}</h2>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
      )}
      {menu.length > 0 && (
        <div className="actions">
          {menu.map((item) => {
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
          })}
        </div>
      )}
    </div>
  );
};

export default Header;