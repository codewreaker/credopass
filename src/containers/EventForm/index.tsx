/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  FileText,
  Trash2
} from 'lucide-react';
import { eventCollection as collection } from '../../server/collections/events.js';
import type { Event, EventStatus } from '../../server/db/schema.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select.js';
import { Textarea } from '../../components/ui/textarea.js';
import './style.css';
import type { LauncherState } from '../../store.js';

// Modal form data type - exported for type safety
export interface EventFormData {
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

export interface EventFormProps {
  initialData?: Partial<EventFormData>;
  isEditing?: boolean;
  onClose?: () => void;
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

// Status options for the select
const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const launchEventForm = (
  args: Omit<EventFormProps, 'collection'> = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <EventForm {...args} />,
  });
};

// Event Form Component
const EventForm = ({ initialData = {}, isEditing = false, onClose }: EventFormProps) => {

  const [formData, setFormData] = useState<EventFormData>({ ...initialFormData, ...initialData });
  const [isMutating, setIsMutating] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (value: string | null) => {
    if (value) {
      setFormData((prev) => ({ ...prev, status: value as EventStatus }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsMutating(true);
    const now = new Date();
    const eventData = {
      name: formData.name,
      description: formData.description || null,
      status: formData.status,
      startTime: new Date(formData.startTime),
      endTime: new Date(formData.endTime),
      location: formData.location,
      capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
      hostId: formData.hostId,
    };

    try {
      if (isEditing && formData.id) {
        collection?.update(formData.id, (draft) => {
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
        collection?.insert({
          ...eventData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
      }
      onClose?.();
    } catch (error) {
      console.error('Failed to save event:', error);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (formData.id && confirm('Are you sure you want to delete this event?')) {
      setIsMutating(true);
      try {
        collection?.delete(formData.id);
        onClose?.();
      } catch (error) {
        console.error('Failed to delete event:', error);
      } finally {
        setIsMutating(false);
      }
    }
  };

  return (
    <div className="event-modal">
      <div className="modal-header">
        <h2>{isEditing ? 'Edit Event' : 'New Event'}</h2>
        <p>{isEditing ? 'Update event details' : 'Create a new calendar event'}</p>
      </div>

      <div className="modal-body">
        <form className="event-form" onSubmit={handleSubmit}>
          {/* Event Name */}
          <div className="form-group full-width">
            <Label className="form-label">
              <CalendarIcon size={14} />
              Event Name
            </Label>
            <Input
              type="text"
              name="name"
              placeholder="Enter event name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Start & End Time */}
          <div className="form-row">
            <div className="form-group">
              <Label className="form-label">
                <Clock size={14} />
                Start Time
              </Label>
              <Input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <Label className="form-label">
                <Clock size={14} />
                End Time
              </Label>
              <Input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Location */}
          <div className="form-group full-width">
            <Label className="form-label">
              <MapPin size={14} />
              Location
            </Label>
            <Input
              type="text"
              name="location"
              placeholder="Enter location"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Status & Capacity */}
          <div className="form-row">
            <div className="form-group">
              <Label className="form-label">Status</Label>
              <Select value={formData.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="form-group">
              <Label className="form-label">
                <Users size={14} />
                Capacity
              </Label>
              <Input
                type="number"
                name="capacity"
                placeholder="Max attendees"
                value={formData.capacity}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Host ID */}
          <div className="form-group full-width">
            <Label className="form-label">
              <Users size={14} />
              Host ID
            </Label>
            <Input
              type="text"
              name="hostId"
              placeholder="Host ID (Current User)"
              value={formData.hostId}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Description */}
          <div className="form-group full-width">
            <Label className="form-label">
              <FileText size={14} />
              Description
            </Label>
            <Textarea
              name="description"
              placeholder="Enter event description (optional)"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="form-actions">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isMutating}
              >
                <Trash2 size={14} />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isMutating}
            >
              {isMutating ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>

      {isMutating && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
};



export default EventForm;