import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LucidePanelRightOpen } from 'lucide-react';
import { useAppStore } from '../../stores/store';
import ProfileView from './ProfileView';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@credopass/ui/components/sheet";

import { Button } from "@credopass/ui/components/button"

import './style.css';

export const RightSidebarTrigger: React.FC = () => {
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar);
  const setViewedItem = useAppStore(state => state.setViewedItem);

  const onToggleCollapse = () => {
    setViewedItem(null);
    toggleSidebar('right');
  }

  return (
    <button className="collapse-toggle-right" onClick={onToggleCollapse}>
      <LucidePanelRightOpen size={15} />
    </button>
  )
}

export const RightSidebar: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const isCollapsed = useAppStore(({ sidebarOpen }) => (sidebarOpen['right']))
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar)
  const viewedItem = useAppStore(({ viewedItem }) => viewedItem)
  const setViewedItem = useAppStore(state => state.setViewedItem);

  const isProfileView = viewedItem !== null;
  const onToggleCollapse = () => toggleSidebar('right')

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

  console.log(viewedItem);
  return (
    <Sheet open={isCollapsed} onOpenChange={onToggleCollapse}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isProfileView ? "Profile" : "Overview"}</SheetTitle>
          <SheetDescription>
            {isProfileView ?
              `${viewedItem?.firstName} ${viewedItem?.lastName}` :
              "Overview of loyalty status and upcoming events."
            }
          </SheetDescription>
        </SheetHeader>
        {/**Sheet Content */}
        <div className="grid flex-1 auto-rows-min gap-6 px-4 h-[calc(100vh-52.5px)] overflow-y-auto sticky">
          <>
            {viewedItem ? (
              <ProfileView data={viewedItem} onClose={() => setViewedItem(null)} />
            ) : (
              <>
                <div className="calendar-widget">
                  <div className="calendar-header">
                    <h3>Calendar</h3>
                    <div className="calendar-controls">
                      <button onClick={previousMonth} className="calendar-nav-btn">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="calendar-month">{monthName}</span>
                      <button onClick={nextMonth} className="calendar-nav-btn">
                        <ChevronRight size={14} />
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
                        <CalendarIcon size={12} />
                        <span>Dec 12</span>
                      </div>
                      <div className="event-info">
                        <p className="event-title">Monthly Meetup</p>
                        <p className="event-time">2:00 PM</p>
                      </div>
                    </div>
                    <div className="event-item">
                      <div className="event-date">
                        <CalendarIcon size={12} />
                        <span>Dec 18</span>
                      </div>
                      <div className="event-info">
                        <p className="event-title">Loyalty Awards</p>
                        <p className="event-time">6:00 PM</p>
                      </div>
                    </div>
                    <div className="event-item">
                      <div className="event-date">
                        <CalendarIcon size={12} />
                        <span>Dec 25</span>
                      </div>
                      <div className="event-info">
                        <p className="event-title">Holiday Special</p>
                        <p className="event-time">12:00 PM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        </div>
        {/**Sheet Content */}
        <SheetFooter>
          <Button type="submit">Save changes</Button>
          <SheetClose>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
};
