import React, { useState } from 'react';
import { Search, Bell, Calendar, User, ChevronDown } from 'lucide-react';
import './TopNavBar.css';

interface TopNavBarProps {
  onNewEventClick: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ onNewEventClick }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="top-navbar">
      <div className="navbar-left">
        <div className="logo">
          <div className="logo-icon">DP</div>
          <span className="logo-text">DwellPass</span>
        </div>
        <div className="nav-links">
          <a href="#dashboard" className="nav-link active">Dashboard</a>
          <a href="#members" className="nav-link">Members</a>
          <a href="#events" className="nav-link">Events</a>
          <a href="#reports" className="nav-link">Reports</a>
        </div>
      </div>
      
      <div className="navbar-right">
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search members, events..." 
            className="search-input"
          />
        </div>
        
        <button className="new-event-btn" onClick={onNewEventClick}>
          <Calendar size={18} />
          <span>New Event</span>
        </button>
        
        <button className="icon-btn">
          <Bell size={20} />
          <span className="notification-badge">3</span>
        </button>
        
        <div className="avatar-dropdown">
          <button 
            className="avatar-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="avatar">
              <User size={20} />
            </div>
            <ChevronDown size={16} />
          </button>
          
          {showDropdown && (
            <div className="dropdown-menu">
              <div className="dropdown-item">Profile</div>
              <div className="dropdown-item">Settings</div>
              <div className="dropdown-divider" />
              <div className="dropdown-item">Logout</div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
