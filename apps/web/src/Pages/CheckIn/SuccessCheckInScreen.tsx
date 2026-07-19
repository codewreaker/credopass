import React from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';
import './style.css';

interface SuccessCheckInScreenProps {
  user: Partial<User>;
  checkInCount: number;
  eventName: string;
}

const SuccessCheckInScreen: React.FC<SuccessCheckInScreenProps> = ({
  user,
  checkInCount,
  eventName,
}) => {
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="success-overlay">
      {/* Counter badge */}
      <div className="success-counter">
        <Users size={16} className="text-primary" />
        <span className="success-counter-number">{checkInCount}</span>
        <span className="success-counter-label">today</span>
      </div>

      {/* Main card -- inspired by Luma guest check-in sheet (Screenshot 4) */}
      <div className="success-card">
        <div className="success-icon-ring">
          <CheckCircle2 size={40} />
        </div>

        {/* Guest info -- Luma pattern: avatar, name, then data grid */}
        <div className="success-avatar">
          {initials}
        </div>

        <h2 className="success-name">
          {user.firstName} {user.lastName}
        </h2>

        <div className="success-details">
          <div className="success-detail-item">
            <span className="success-detail-label">Email</span>
            <span className="success-detail-value">{user.email}</span>
          </div>
          <div className="success-detail-item">
            <span className="success-detail-label">Status</span>
            <span className="success-detail-value success-status-going">Going</span>
          </div>
          <div className="success-detail-item">
            <span className="success-detail-label">Check-In Time</span>
            <span className="success-detail-value">Today, {timeString}</span>
          </div>
        </div>

        <div className="success-event-name">{eventName}</div>
      </div>

      {/* Pulse indicator */}
      <div className="success-pulse-row">
        <div className="success-pulse-dot" />
        <span>Returning to scanner...</span>
      </div>
    </div>
  );
};

export default SuccessCheckInScreen;
