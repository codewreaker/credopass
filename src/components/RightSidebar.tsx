import React, { useState } from 'react';
import { Star, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import './RightSidebar.css';

export const RightSidebar: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };
  
  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };
  
  const today = new Date().getDate();
  const isCurrentMonth = 
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  return (
    <aside className="right-sidebar">
      <div className="loyalty-card">
        <div className="card-header">
          <Star className="star-icon" size={24} fill="var(--primary-yellow)" />
          <h3>Loyalty Status</h3>
        </div>
        <div className="card-content">
          <div className="loyalty-level">
            <div className="level-badge">GOLD</div>
            <p className="level-text">Member Level</p>
          </div>
          <div className="loyalty-stats">
            <div className="stat-item">
              <span className="stat-value">2,450</span>
              <span className="stat-label">Points</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value">89%</span>
              <span className="stat-label">Attendance</span>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '75%' }} />
          </div>
          <p className="progress-text">750 points to Platinum</p>
        </div>
      </div>
      
      <div className="calendar-widget">
        <div className="calendar-header">
          <h3>Calendar</h3>
          <div className="calendar-controls">
            <button onClick={previousMonth} className="calendar-nav-btn">
              <ChevronLeft size={18} />
            </button>
            <span className="calendar-month">{monthName}</span>
            <button onClick={nextMonth} className="calendar-nav-btn">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        
        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="calendar-day empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const hasEvent = [5, 12, 18, 25].includes(day);
              const isToday = isCurrentMonth && day === today;
              
              return (
                <div 
                  key={day} 
                  className={`calendar-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}`}
                >
                  {day}
                  {hasEvent && <div className="event-dot" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="upcoming-events">
        <h4>Upcoming Events</h4>
        <div className="event-list">
          <div className="event-item">
            <div className="event-date">
              <CalendarIcon size={16} />
              <span>Dec 12</span>
            </div>
            <div className="event-info">
              <p className="event-title">Monthly Meetup</p>
              <p className="event-time">2:00 PM</p>
            </div>
          </div>
          <div className="event-item">
            <div className="event-date">
              <CalendarIcon size={16} />
              <span>Dec 18</span>
            </div>
            <div className="event-info">
              <p className="event-title">Loyalty Awards</p>
              <p className="event-time">6:00 PM</p>
            </div>
          </div>
          <div className="event-item">
            <div className="event-date">
              <CalendarIcon size={16} />
              <span>Dec 25</span>
            </div>
            <div className="event-info">
              <p className="event-title">Holiday Special</p>
              <p className="event-time">12:00 PM</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
