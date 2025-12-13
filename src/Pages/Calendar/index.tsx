import { useRef, useCallback, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { 
  Plus, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  FileText,
  Tag,
  Trash2
} from 'lucide-react';
import { useLiveQuery } from '@tanstack/react-db';
import { eventCollection } from '../../collections/events';
import type { Event, EventStatus } from '../../entities/schemas';
import { useModal } from '../../components/Modal/useModal';
import './style.css';

// Modal form data type
interface EventFormData {
  id?: string;
  name: string;
  description: string;
  status: EventStatus;
  startTime: string;
  endTime: string;
  location: string;
  capacity: string;
  hostId: string;
}

const initialFormData: EventFormData = {
  name: '',
  description: '',
  status: 'scheduled',
  startTime: '',
  endTime: '',
  location: '',
  capacity: '',
  hostId: '',
};

// Helper to format date for datetime-local input
const formatDateForInput = (date: Date): string => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Helper to get end of day
const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const { openModal, closeModal } = useModal();
  const [isMutating, setIsMutating] = useState(false);

  // Fetch events using TanStack DB live query
  const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
  const events = useMemo<Event[]>(() => Array.isArray(eventsData) ? eventsData : [], [eventsData]);

  // Transform events for FullCalendar
  const calendarEvents = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.name,
    start: new Date(event.startTime),
    end: new Date(event.endTime),
    extendedProps: {
      description: event.description,
      status: event.status,
      location: event.location,
      capacity: event.capacity,
      hostId: event.hostId,
    },
    classNames: [`event-${event.status}`],
  })), [events]);

  // Event Form Component - lives here with the business logic
  const EventForm = ({ initialData, isEditing }: { initialData: Partial<EventFormData>, isEditing: boolean }) => {
    const [formData, setFormData] = useState<EventFormData>({ ...initialFormData, ...initialData });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const now = new Date();
      const eventData = {
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status,
        startTime: new Date(formData.startTime),
        endTime: new Date(formData.endTime),
        location: formData.location,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : undefined,
        hostId: formData.hostId,
      };

      try {
        setIsMutating(true);
        if (isEditing && formData.id) {
          eventCollection.update(formData.id, (draft) => {
            draft.name = eventData.name;
            draft.description = eventData.description;
            draft.status = eventData.status;
            draft.startTime = eventData.startTime;
            draft.endTime = eventData.endTime;
            draft.location = eventData.location;
            draft.capacity = eventData.capacity;
            draft.hostId = eventData.hostId;
            draft.updatedAt = now;
          });
        } else {
          eventCollection.insert({
            ...eventData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          } as Event);
        }
        closeModal();
      } catch (error) {
        console.error('Failed to save event:', error);
      } finally {
        setIsMutating(false);
      }
    };

    const handleDelete = async () => {
      if (formData.id && confirm('Are you sure you want to delete this event?')) {
        try {
          setIsMutating(true);
          eventCollection.delete(formData.id);
          closeModal();
        } catch (error) {
          console.error('Failed to delete event:', error);
        } finally {
          setIsMutating(false);
        }
      }
    };

    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="modal-container event-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={closeModal}>
            <X size={18} />
          </button>

          <div className="modal-header">
            <h2>{isEditing ? 'Edit Event' : 'New Event'}</h2>
            <p>{isEditing ? 'Update event details' : 'Create a new calendar event'}</p>
          </div>

          <div className="modal-body">
            <form className="event-form" onSubmit={handleSubmit}>
              {/* Event Name */}
              <div className="form-group full-width">
                <label>
                  <CalendarIcon size={14} />
                  Event Name
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter event name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Start & End Time */}
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <Clock size={14} />
                    Start Time
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="datetime-local"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      required
                      style={{ paddingLeft: '0.75rem' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <Clock size={14} />
                    End Time
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="datetime-local"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleInputChange}
                      required
                      style={{ paddingLeft: '0.75rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="form-group full-width">
                <label>
                  <MapPin size={14} />
                  Location
                </label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={14} />
                  <input
                    type="text"
                    name="location"
                    placeholder="Enter location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Status & Capacity */}
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <Tag size={14} />
                    Status
                  </label>
                  <div className="input-wrapper">
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      style={{ paddingLeft: '0.75rem' }}
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <Users size={14} />
                    Capacity
                  </label>
                  <div className="input-wrapper">
                    <Users className="input-icon" size={14} />
                    <input
                      type="number"
                      name="capacity"
                      placeholder="Max attendees"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Host ID */}
              <div className="form-group full-width">
                <label>
                  <Users size={14} />
                  Host ID
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="hostId"
                    placeholder="Host ID (Current User)"
                    value={formData.hostId}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group full-width">
                <label>
                  <FileText size={14} />
                  Description
                </label>
                <div className="input-wrapper">
                  <textarea
                    name="description"
                    placeholder="Enter event description (optional)"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="form-actions">
                {isEditing && (
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={handleDelete}
                    disabled={isMutating}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                  disabled={isMutating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={isMutating}
                >
                  {isMutating ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>

          {isMutating && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calendar event handlers
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    const start = selectInfo.start;
    const end = selectInfo.end;
    
    // For all-day selections, set appropriate times
    let startTime: Date;
    let endTime: Date;
    
    if (selectInfo.allDay) {
      startTime = new Date(start);
      startTime.setHours(9, 0, 0, 0);
      endTime = new Date(start);
      endTime.setHours(10, 0, 0, 0);
    } else {
      startTime = start;
      endTime = end;
    }

    // Open modal with the EventForm component
    openModal(
      <EventForm 
        initialData={{
          startTime: formatDateForInput(startTime),
          endTime: formatDateForInput(endTime),
        }}
        isEditing={false}
      />
    );

    // Clear selection
    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal]);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    
    // Open modal with the EventForm component
    openModal(
      <EventForm
        initialData={{
          id: event.id,
          name: event.title,
          description: event.extendedProps.description || '',
          status: event.extendedProps.status,
          startTime: formatDateForInput(event.start!),
          endTime: formatDateForInput(event.end || getEndOfDay(event.start!)),
          location: event.extendedProps.location || '',
          capacity: event.extendedProps.capacity?.toString() || '',
          hostId: event.extendedProps.hostId || '',
        }}
        isEditing={true}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openModal]);

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const event = dropInfo.event;
    
    try {
      setIsMutating(true);
      eventCollection.update(event.id, (draft) => {
        draft.startTime = event.start!;
        draft.endTime = event.end || getEndOfDay(event.start!);
        draft.updatedAt = new Date();
      });
    } catch (error) {
      console.error('Failed to update event:', error);
      dropInfo.revert();
    } finally {
      setIsMutating(false);
    }
  }, []);

  const handleEventResize = useCallback(async (resizeInfo: EventResizeDoneArg) => {
    const event = resizeInfo.event;
    
    try {
      setIsMutating(true);
      eventCollection.update(event.id, (draft) => {
        draft.startTime = event.start!;
        draft.endTime = event.end!;
        draft.updatedAt = new Date();
      });
    } catch (error) {
      console.error('Failed to resize event:', error);
      resizeInfo.revert();
    } finally {
      setIsMutating(false);
    }
  }, []);

  const handleAddEventClick = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const end = new Date(now);
    end.setHours(now.getHours() + 1);

    openModal(
      <EventForm
        initialData={{
          startTime: formatDateForInput(now),
          endTime: formatDateForInput(end),
        }}
        isEditing={false}
      />
    );
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h2>Events Calendar</h2>
        <button className="add-event-btn" onClick={handleAddEventClick}>
          <Plus size={16} />
          New Event
        </button>
      </div>

      <div className="calendar-container">
        {isMutating && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          events={calendarEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          nowIndicator={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          height="100%"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={true}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List',
          }}
        />
      </div>
    </div>
  );
}
