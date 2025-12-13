import React from 'react';
import { Search, Bell, Calendar, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { Menu } from '@base-ui/react/menu';
import { Button } from '../../components/ui';
import './style.css';
import { useLauncher } from '../../store';
import { launchEventForm } from '../EventForm';



export const TopNavBar: React.FC = () => {
    const { openLauncher } = useLauncher();

  const onNewEventClick = () => launchEventForm({ isEditing: false }, openLauncher);

  return (
    <nav className="top-navbar">
      <div className="navbar-left">
        <div className="logo">
          <div className="logo-icon">DP</div>
          <span className="logo-text">DwellPass</span>
        </div>
      </div>

      <div className="navbar-center">
        <div className="search-container">
          <Search className="search-icon" size={14} />
          <input
            type="text"
            placeholder="Search members, events..."
            className="search-input"
          />
        </div>
      </div>


      <div className="navbar-right">
        <Button variant="primary" onClick={onNewEventClick} leftIcon={<Calendar size={14} />}>
          New Event
        </Button>

        <Button variant="icon" className="notification-btn">
          <Bell size={15} />
          <span className="notification-badge">3</span>
        </Button>

        <Menu.Root>
          <Menu.Trigger className="avatar-btn">
            <div className="avatar">
              <User size={15} />
            </div>
            <ChevronDown size={12} />
          </Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={6}>
              <Menu.Popup className="dropdown-menu">
                <Menu.Item className="dropdown-item">
                  <User size={14} />
                  <span>Profile</span>
                </Menu.Item>
                <Menu.Item className="dropdown-item">
                  <Settings size={14} />
                  <span>Settings</span>
                </Menu.Item>
                <Menu.Separator className="dropdown-divider" />
                <Menu.Item className="dropdown-item">
                  <LogOut size={14} />
                  <span>Logout</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </nav>
  );
};
