import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, CalendarHeart, CheckIcon, Mail, PencilIcon, Phone, ScanLine, Star, UserPlus } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Spinner } from '@credopass/ui/components/spinner';
import { FieldError } from '@credopass/ui/components/field';
import { cn } from '@credopass/ui/lib/utils';
import type { EventType } from '@credopass/lib/schemas';
import { RoleField } from './fields/role-field';
import { TextField } from './fields/text-field';
import { useMemberForm, type MemberFormValues } from './use-member-form';

interface MemberComposerProps {
  mode: 'create' | 'edit';
  userId?: string;
  /** Members are added onto an event, so the composer is scoped by one. */
  event?: EventType | null;
  eventId?: string;
  initialValues?: Partial<MemberFormValues>;
}

const PERKS = [
  { icon: ScanLine, label: 'QR check-in' },
  { icon: Star, label: 'Earn points' },
  { icon: CalendarHeart, label: 'Event invites' },
] as const;

/**
 * The standalone add/edit member page — the same shape as the event composer:
 * a lime billboard carrying the identity, granular SheetDialog popups for every
 * other field, and a sticky full-width submit.
 */
export function MemberComposer({ mode, userId, event, eventId, initialValues }: MemberComposerProps) {
  const navigate = useNavigate();
  const isEditing = mode === 'edit';
  const scopedEventId = eventId ?? event?.id;

  const { form, isMutating } = useMemberForm({
    mode,
    userId,
    eventId: scopedEventId,
    initialValues,
    onSaved: () =>
      scopedEventId
        ? navigate({ to: '/events/$eventId', params: { eventId: scopedEventId } })
        : navigate({ to: '/attendees' }),
  });

  const handleBack = () =>
    scopedEventId
      ? navigate({ to: '/events/$eventId', params: { eventId: scopedEventId } })
      : navigate({ to: '/attendees' });

  return (
    <div className="mx-auto w-full max-w-140 pb-4 md:max-w-160 lg:max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {/* Lime billboard — the member card fills in as they type */}
        <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-primary-foreground/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-32 size-64 rounded-full border border-primary-foreground/10"
          />

          <div className="relative flex items-center gap-2">
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
            {event && (
              <span className="min-w-0 truncate rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold">
                {event.name}
              </span>
            )}
            <span className="ml-auto shrink-0 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              {isEditing ? 'Editing' : 'New'}
            </span>
          </div>

          <div className="relative mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <form.Field name="firstName">
              {(field) => (
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  autoFocus
                  autoComplete="off"
                  placeholder="First name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-primary-foreground/40 sm:w-auto sm:flex-1"
                />
              )}
            </form.Field>
            <form.Field name="lastName">
              {(field) => (
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  autoComplete="off"
                  placeholder="Last name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-primary-foreground/40 sm:w-auto sm:flex-1"
                />
              )}
            </form.Field>
          </div>

          <form.Subscribe selector={(state) => state.values.email}>
            {(email) => (
              <p className="relative mt-1.5 truncate text-xs font-medium text-primary-foreground/65">
                {email || 'their@email.com'}
              </p>
            )}
          </form.Subscribe>
        </div>

        {/* Contact details */}
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Contact
          </span>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <form.Field name="email">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <TextField
                    label="Email"
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    placeholder="john.doe@example.com"
                    value={field.state.value}
                    onChange={field.handleChange}
                    invalid={isInvalid}
                    errors={field.state.meta.errors}
                  />
                );
              }}
            </form.Field>
            <form.Field name="phone">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <TextField
                    label="Phone"
                    icon={Phone}
                    type="tel"
                    inputMode="tel"
                    optional
                    placeholder="+1 (555) 000-0000"
                    value={field.state.value}
                    onChange={field.handleChange}
                    invalid={isInvalid}
                    errors={field.state.meta.errors}
                  />
                );
              }}
            </form.Field>
          </div>
        </div>

        {/* Event membership */}
        {scopedEventId && (
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              On this event
            </span>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <form.Field name="role">
                {(field) => <RoleField value={field.state.value} onChange={field.handleChange} />}
              </form.Field>
            </div>
          </div>
        )}

        {/* Perks strip — only worth showing for someone brand new */}
        {!isEditing && (
          <div className="grid grid-cols-3 gap-2">
            {PERKS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card/60 py-2.5"
              >
                <Icon size={14} className="text-primary" />
                <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}

        <form.Subscribe selector={(state) => [state.isTouched, state.errors] as const}>
          {([isTouched, errors]) =>
            isTouched && errors.length > 0 ? (
              <FieldError errors={errors as never} className="px-1" />
            ) : null
          }
        </form.Subscribe>

        {/* Submit — sticks to the bottom of the scroll area */}
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
                    {scopedEventId ? <UserPlus /> : <CheckIcon />}
                    {scopedEventId ? 'Add to event' : 'Add attendee'}
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
