import React from 'react';
import { Search, Bell, Calendar, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../components/ui/dropdown-menu.js';
import { Button } from '../../components/ui/button.js';
import './style.css';
import { useLauncher } from '../../store.js';
import { launchEventForm } from '../EventForm/index.js';
import { launchSignInForm } from '../SignInModal/index.js';



export const TopNavBar: React.FC = () => {
    const { openLauncher } = useLauncher();

  const onNewEventClick = () => launchEventForm({ isEditing: false }, openLauncher);
  const onProfileClick = () => launchSignInForm({}, openLauncher);

  return (
    <div className="top-navbar">

      <div className="navbar-left">
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
        <Button variant="default" onClick={onNewEventClick}>
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
