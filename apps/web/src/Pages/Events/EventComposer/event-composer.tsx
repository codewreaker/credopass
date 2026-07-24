import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, CheckIcon, Globe, PencilIcon } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Spinner } from '@credopass/ui/components/spinner';
import { FieldError } from '@credopass/ui/components/field';
import { cn } from '@credopass/ui/lib/utils';
import { EventImage } from './fields/event-image';
import { DateTimeField } from './fields/date-time-field';
import { LocationField } from './fields/location-field';
import { DescriptionField } from './fields/description-field';
import { CapacityField, StatusField } from './fields/option-fields';
import { OrgField } from './org-field';
import { DEFAULT_DURATION_MS, useEventForm, type EventFormValues } from './use-event-form';

interface EventComposerProps {
  mode: 'create' | 'edit';
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
}

const timeZoneLabel = () => {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    return `GMT${sign}${hours}:${minutes} · ${zone}`;
  } catch {
    return '';
  }
};

/**
 * The standalone create/edit event page. One component serves both modes —
 * `mode` only changes the copy, the status row and where we navigate on save.
 *
 * Every non-trivial input (date, location, description, capacity, status) opens
 * a granular SheetDialog instead of being edited inline, which keeps this page
 * scannable and keeps the keyboard from covering anything on mobile.
 */
export function EventComposer({ mode, eventId, initialValues }: EventComposerProps) {
  const navigate = useNavigate();
  const isEditing = mode === 'edit';

  const { form, isMutating } = useEventForm({
    mode,
    eventId,
    initialValues,
    onSaved: (id) => navigate({ to: '/events/$eventId', params: { eventId: id } }),
  });

  const handleBack = () =>
    isEditing && eventId
      ? navigate({ to: '/events/$eventId', params: { eventId } })
      : navigate({ to: '/events' });

  // Focus the name field on a fresh create. The `autoFocus` attribute doesn't
  // fire reliably for an input mounted through a route/Suspense boundary, so
  // drive it explicitly once on mount.
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isEditing) nameInputRef.current?.focus();
  }, [isEditing]);

  // Cover image — preview only for now (no cover column yet); defaults to the
  // calendar illustration and can be replaced from a file or the camera.
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);

  return (
    <div className="mx-auto w-full max-w-140 pb-4 md:max-w-160 lg:max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <EventImage src={coverImage} onPick={setCoverImage} />

        {/* Lime billboard header — org pill, mode label and the event name */}
        <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-primary-foreground/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-32 size-64 rounded-full border border-primary-foreground/10"
          />

          <div className="relative flex items-center gap-2 mb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleBack}
              className="-ml-1 rounded-full text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft />
              <span className="sr-only">Back</span>
            </Button>
            <form.Field name="organizationId">
              {(field) => <OrgField value={field.state.value} onChange={field.handleChange} />}
            </form.Field>
            <span className="ml-auto rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              {isEditing ? 'Editing' : 'New'}
            </span>
          </div>


          <form.Field name="name">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <div className="relative mt-4">
                  <input
                    ref={nameInputRef}
                    id={field.name}
                    name={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Event Name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-primary-foreground/40"
                  />
                  {isInvalid && (
                    <FieldError
                      errors={field.state.meta.errors}
                      className="mt-1.5 text-xs font-medium text-primary-foreground/80"
                    />
                  )}
                </div>
              );
            }}
          </form.Field>
        </div>

        {/* When */}
        <div className="rounded-2xl border border-border bg-card p-1.5">
          <form.Field name="start">
            {(startField) => (
              <form.Field name="end">
                {(endField) => (
                  <>
                    <DateTimeField
                      label="Start"
                      connectBelow
                      value={startField.state.value}
                      onChange={(date) => {
                        startField.handleChange(date);
                        // Keep the gap the user already has; fall back to an hour.
                        if (!date) return;
                        const previous = startField.state.value;
                        const currentEnd = endField.state.value;
                        const duration =
                          previous && currentEnd && currentEnd > previous
                            ? currentEnd.getTime() - previous.getTime()
                            : DEFAULT_DURATION_MS;
                        endField.handleChange(new Date(date.getTime() + duration));
                      }}
                      invalid={startField.state.meta.isTouched && !startField.state.meta.isValid}
                    />
                    <DateTimeField
                      label="End"
                      marker="hollow"
                      connectAbove
                      value={endField.state.value}
                      minDate={startField.state.value}
                      onChange={endField.handleChange}
                      invalid={endField.state.meta.isTouched && !endField.state.meta.isValid}
                    />
                    <div className="flex items-center gap-2 px-3 pb-2 pt-1 text-xs text-muted-foreground">
                      <Globe size={13} />
                      {timeZoneLabel()}
                    </div>
                    {endField.state.meta.isTouched && !endField.state.meta.isValid && (
                      <div className="px-3 pb-2">
                        <FieldError errors={endField.state.meta.errors} />
                      </div>
                    )}
                  </>
                )}
              </form.Field>
            )}
          </form.Field>
        </div>

        {/* Where & what */}
        <form.Field name="location">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <LocationField
                value={field.state.value}
                onChange={field.handleChange}
                invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              />
              {field.state.meta.isTouched && !field.state.meta.isValid && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => <DescriptionField value={field.state.value} onChange={field.handleChange} />}
        </form.Field>

        {/* Event options */}
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Event Options
          </span>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <form.Field name="capacity">
              {(field) => (
                <CapacityField
                  value={field.state.value}
                  onChange={field.handleChange}
                  invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              )}
            </form.Field>
            {isEditing && (
              <form.Field name="status">
                {(field) => <StatusField value={field.state.value} onChange={field.handleChange} />}
              </form.Field>
            )}
          </div>
        </div>

        {/* Submit — sticks to the bottom of the scroll area like Luma's CTA */}
        <div
          className={cn(
            'sticky bottom-0 -mx-1 mt-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3',
            'bg-linear-to-t from-background via-background to-transparent'
          )}
        >
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isMutating || isSubmitting}
                className="h-12 w-full rounded-full text-sm font-semibold"
              >
                {isMutating || isSubmitting ? (
                  <Spinner />
                ) : isEditing ? (
                  <>
                    <PencilIcon /> Save changes
                  </>
                ) : (
                  <>
                    <CheckIcon /> Create Event
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
