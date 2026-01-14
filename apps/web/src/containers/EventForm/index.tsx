import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import * as z from 'zod';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  FileText,
  Trash2
} from 'lucide-react';
import { getCollections } from '../../lib/tanstack-db';
import type { EventStatus } from '@credopass/lib/schemas';
import {
  Button,
  Input,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@credopass/ui';
import './style.css';
import type { LauncherState } from '../../stores/store';

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

// Status options for the select
const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Zod validation schema
const eventFormSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters.').max(100, 'Event name must be at most 100 characters.'),
  description: z.string().max(500, 'Description must be at most 500 characters.').default(''),
  status: z.enum(['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'] as const),
  startTime: z.string().min(1, 'Start time is required.'),
  endTime: z.string().min(1, 'End time is required.'),
  location: z.string().min(3, 'Location must be at least 3 characters.').max(200, 'Location must be at most 200 characters.'),
  capacity: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0), 'Capacity must be a positive number.').default(''),
  hostId: z.string().min(1, 'Host ID is required.'),
}).superRefine((data, ctx) => {
  if (data.startTime && data.endTime) {
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time.',
        path: ['endTime'],
      });
    }
  }
});

export const launchEventForm = (
  args: Omit<EventFormProps, 'collection'> = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <EventForm {...args} />,
  });
};

const { events: eventCollection } = getCollections();

// Event Form Component
const EventForm = ({ initialData = {}, isEditing = false, onClose }: EventFormProps) => {
  const [isMutating, setIsMutating] = useState(false);

  const rand = crypto.randomUUID();
  const form = useForm({
    defaultValues: {
      name: initialData.name || `New Event ${rand.slice(0, 8)}`,
      description: initialData.description || '',
      status: (initialData.status || 'scheduled') as EventStatus,
      startTime: initialData.startTime || '',
      endTime: initialData.endTime || '',
      location: initialData.location || 'london',
      capacity: initialData.capacity || '',
      hostId: initialData.hostId || '',
    },
    validators: {
      //@ts-ignore
      onChange: eventFormSchema,
    },
    onSubmit: async ({ value }) => {
      setIsMutating(true);
      const now = new Date();
      const eventData = {
        name: value.name,
        description: value.description || null,
        status: value.status,
        startTime: new Date(value.startTime),
        endTime: new Date(value.endTime),
        location: value.location,
        capacity: value.capacity ? parseInt(value.capacity, 10) : null,
        hostId: value.hostId,
      };

      try {
        let tx;

        if (isEditing && initialData.id) {
          tx = eventCollection.update(initialData.id, (draft) => {
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
          tx = eventCollection.insert({
            ...eventData,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          });
        }

        await tx.isPersisted.promise;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred.');
        onClose?.();
      } finally {
        setIsMutating(false);
      }
    },
  });

  const handleDelete = async () => {
    if (initialData.id && confirm('Are you sure you want to delete this event?')) {
      setIsMutating(true);
      try {
        eventCollection?.delete(initialData.id);
        onClose?.();
      } catch (error) {
        console.error('Failed to delete event:', error);
      } finally {
        setIsMutating(false);
      }
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Event' : 'New Event'}</DialogTitle>
        <DialogDescription>
          {isEditing ? 'Update event details' : 'Create a new calendar event'}
        </DialogDescription>
      </DialogHeader>


      <div className="grid gap-4">
        <form
          className="event-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            {/* Event Name */}
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <CalendarIcon size={14} />
                      Event Name
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="Enter event name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Start & End Time */}
            <div className="form-row">
              <form.Field
                name="startTime"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <Clock size={14} />
                        Start Time
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="endTime"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <Clock size={14} />
                        End Time
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
            </div>

            {/* Location */}
            <form.Field
              name="location"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <MapPin size={14} />
                      Location
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="Enter location"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Status & Capacity */}
            <div className="form-row">
              <form.Field
                name="status"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">Status</FieldLabel>
                      <Select
                        name={field.name}
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as EventStatus)}
                      >
                        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
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
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              <form.Field
                name="capacity"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <Users size={14} />
                        Capacity
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        placeholder="Max attendees"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      <FieldDescription>Optional - Leave blank for unlimited capacity</FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
            </div>

            {/* Host ID */}
            <form.Field
              name="hostId"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <Users size={14} />
                      Host ID
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="Host ID (Current User)"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Description */}
            <form.Field
              name="description"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel htmlFor={field.name} className="form-label">
                      <FileText size={14} />
                      Description
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      placeholder="Enter event description (optional)"
                      value={field.state.value || ''}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={3}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>Provide details about the event</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />
          </FieldGroup>

          <DialogFooter>
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
            <DialogClose>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isMutating}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="default"
              disabled={isMutating}
            >
              {isMutating ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </div>

    </>
  )
};



export default EventForm;