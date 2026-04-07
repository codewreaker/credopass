import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { format } from 'date-fns/format';
import {
  Calendar as CalendarIcon,
  MapPin,
  Users,
  FileText,
  Building2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { getCollections } from '@credopass/api-client/collections';
import type { EventStatus } from '@credopass/lib/schemas';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@credopass/ui/components/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@credopass/ui/components/select';
import { Textarea } from '@credopass/ui/components/textarea';
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@credopass/ui/components/dialog';
import { Alert, AlertDescription, AlertTitle } from '@credopass/ui/components/alert';
import { Calendar } from '@credopass/ui/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@credopass/ui/components/popover';
import './style.css';
import type { LauncherState } from '@credopass/lib/stores';
import { useOrganizationStore } from '@credopass/lib/stores';
import { cn } from '@credopass/ui/lib/utils';
import { AddressPicker } from '../../components/AddressPicker';

// Modal form data type - exported for type safety
export interface EventFormData {
  id?: string;
  name: string;
  description: string;
  status: EventStatus;
  dateTimeRange: { from?: Date; to?: Date } | undefined;
  location: string;
  capacity: string;
  organizationId: string;
}

export interface EventFormProps {
  initialData?: Partial<EventFormData>;
  isEditing?: boolean;
  onClose?: () => void;
}

// Status options for the select (only shown when editing)
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
  dateTimeRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }).optional().refine((val) => val?.from, 'Start date/time is required.'),
  location: z.string().min(3, 'Location must be at least 3 characters.').max(200, 'Location must be at most 200 characters.'),
  capacity: z.string().refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0), 'Capacity must be a positive number.').default(''),
  organizationId: z.string().min(1, 'Organization is required.'),
}).superRefine((data, ctx) => {
  if (data.dateTimeRange?.from && data.dateTimeRange?.to) {
    if (data.dateTimeRange.to < data.dateTimeRange.from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time.',
        path: ['dateTimeRange'],
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

// Single DateTime Picker Component with separate button
interface DateTimePickerProps {
  label: string;
  value?: Date;
  onChange: (date: Date | undefined) => void;
  icon?: React.ReactNode;
  placeholder?: string;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  value,
  onChange,
  icon,
  placeholder = "Select date & time"
}) => {
  const [time, setTime] = useState(value ? format(value, "HH:mm") : "09:00");

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(undefined);
      return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    onChange(combined);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    if (value) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const combined = new Date(value);
      combined.setHours(hours, minutes, 0, 0);
      onChange(combined);
    }
  };

  return (
    <Popover>
      <PopoverTrigger render={
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-auto py-3",
            !value && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-3 w-full">
            {icon || <CalendarIcon className="size-4" />}
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              {value ? (
                <span className="text-sm font-medium">
                  {format(value, "EEE, MMM d, yyyy")} at {format(value, "h:mm a")}
                </span>
              ) : (
                <span className="text-sm">{placeholder}</span>
              )}
            </div>
          </div>
        </Button>
      } />
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="flex items-center gap-2 p-3 border-t">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Time:</span>
            <Input
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="w-28"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Event Form Component
const EventForm = ({ initialData = {}, isEditing = false, onClose }: EventFormProps) => {
  const [isMutating, setIsMutating] = useState(false);
  const { activeOrganizationId, activeOrganization } = useOrganizationStore();

  const rand = crypto.randomUUID();
  const form = useForm({
    defaultValues: {
      name: initialData.name || `New Event ${rand.slice(0, 8)}`,
      description: initialData.description || '',
      status: (initialData.status || 'scheduled') as EventStatus,
      dateTimeRange: initialData.dateTimeRange || undefined,
      location: initialData.location || '',
      capacity: initialData.capacity || '',
      organizationId: initialData.organizationId || activeOrganizationId || '',
    },
    validators: {
      //@ts-ignore
      onChange: eventFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.organizationId) {
        toast.error('Please select an organization first');
        return;
      }

      if (!value.dateTimeRange?.from) {
        toast.error('Please select a start date');
        return;
      }

      setIsMutating(true);
      const now = new Date();
      const eventData = {
        name: value.name,
        description: value.description || null,
        status: isEditing ? value.status : 'scheduled' as EventStatus, // Default to scheduled for new events
        startTime: value.dateTimeRange.from,
        endTime: value.dateTimeRange.to || value.dateTimeRange.from,
        location: value.location,
        capacity: value.capacity ? parseInt(value.capacity, 10) : null,
        organizationId: value.organizationId,
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
            draft.organizationId = eventData.organizationId;
            draft.updatedAt = now;
          });
        } else {
          tx = eventCollection.insert({
            ...eventData,
            id: crypto.randomUUID(),
            checkInMethods: ['qr', 'manual'],
            requireCheckOut: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
          });
        }

        await tx.isPersisted.promise;
        toast.success(isEditing ? 'Event updated!' : 'Event created!');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unexpected error occurred.');
      } finally {
        setIsMutating(false);
        onClose?.();
      }
    },
  });

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

            {/* Date & Time - Separate Start and End Buttons */}
            <form.Field
              name="dateTimeRange"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                const currentValue = field.state.value || { from: undefined, to: undefined };
                
                return (
                  <Field data-invalid={isInvalid} className="form-group full-width">
                    <FieldLabel className="form-label">
                      <CalendarIcon size={14} />
                      Date & Time
                    </FieldLabel>
                    <div className="flex flex-col gap-3">
                      <DateTimePicker
                        label="Start"
                        value={currentValue.from}
                        onChange={(date) => field.handleChange({ ...currentValue, from: date })}
                        placeholder="Set start date"
                      />
                      <DateTimePicker
                        label="End"
                        value={currentValue.to}
                        onChange={(date) => field.handleChange({ ...currentValue, to: date })}
                        placeholder="Set end date"
                      />
                    </div>
                    <FieldDescription>Select the start and end date/time for your event</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Location & Capacity Row */}
            <div className="form-row">
              {/* Location - Address Picker */}
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
                      <AddressPicker
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        placeholder="Search for an address..."
                      />
                      <FieldDescription>Start typing to search for an address</FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              {/* Status - Only show when editing */}
              {isEditing && (
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
              )}

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
                      <FieldDescription>Leave blank for unlimited (optional)</FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              {/* Organization - Read-only display of active organization */}
              <form.Field
                name="organizationId"
                children={(field) => {
                  const isInvalid = !field.state.value;
                  return (
                    <Field data-invalid={isInvalid} className="form-group">
                      <FieldLabel htmlFor={field.name} className="form-label">
                        <Building2 size={14} />
                        Organization
                      </FieldLabel>
                      {activeOrganization ? (
                        <div className="organization-display">
                          <Building2 size={16} className="text-muted-foreground" />
                          <span>{activeOrganization.name}</span>
                        </div>
                      ) : (
                        <Alert variant="destructive" className="organization-alert">
                          <AlertCircle size={14} />
                          <AlertTitle>No organization selected</AlertTitle>
                          <AlertDescription>
                            Please go to Organizations and select an active organization before creating events.
                          </AlertDescription>
                        </Alert>
                      )}
                      <FieldDescription>
                        Events are created under the currently active organization
                      </FieldDescription>
                    </Field>
                  );
                }}
              />
            </div>


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
