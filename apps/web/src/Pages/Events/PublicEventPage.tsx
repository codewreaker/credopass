/**
 * `/e/$eventId` — the shared link. Standalone: no shell, no nav, no sign-in
 * prompt. Someone scanned a QR or opened a message.
 *
 * Everything comes from `GET /public/events/{id}`, which needs no credential.
 * A **cancelled event still resolves** rather than 404ing — the person holding
 * the link deserves to be told it isn't happening, and why (§2.7).
 *
 * Registering returns `pass.url` synchronously and that is the only copy: there
 * is no email service yet, so this page sends the attendee straight to their
 * pass instead of saying "check your email".
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  CalendarCheck,
  CalendarX2,
  Clock,
  Globe,
  MailQuestion,
  MapPin,
  RotateCw,
  Share2,
  Users,
} from 'lucide-react';
import { format } from 'date-fns/format';
import {
  usePublicEvent,
  usePublicRegister,
  useResendPass,
  type PublicEvent,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { supabase } from '../../supabase';
import { errorMessage, isNotFound } from '../../lib/errors';

const STATUS_STYLE: Record<PublicEvent['status'], string> = {
  scheduled: 'bg-primary-foreground/10',
  ongoing: 'bg-primary-foreground text-primary',
  completed: 'bg-primary-foreground/10',
  cancelled: 'bg-primary-foreground/10',
};

export default function PublicEventPage() {
  const { eventId } = useParams({ from: '/e/$eventId' });
  const { data: event, isLoading, error } = usePublicEvent(eventId);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!event) {
    return isNotFound(error) ? (
      <PublicEventMessage
        icon={<CalendarX2 className="size-8 text-muted-foreground" />}
        title="Event not found"
        description="This event doesn’t exist or the link has expired. Double-check the link from the host."
      />
    ) : (
      <PublicEventMessage
        icon={<RotateCw className="size-8 text-muted-foreground" />}
        title="Couldn’t load this event"
        description={errorMessage(error)}
        action={{ label: 'Try again', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <PublicEventView event={event} />
    </div>
  );
}

function PublicEventView({ event }: { event: PublicEvent }) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/e/${event.id}` : `/e/${event.id}`;
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;

  const isCancelled = event.status === 'cancelled';
  const isEnded = event.status === 'completed' || isCancelled;
  const isFull = event.capacityRemaining !== null && event.capacityRemaining <= 0;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: event.name, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Event link copied');
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-140 flex-col gap-4 px-4 pb-24 pt-6 md:max-w-160">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="-ml-1 gap-2 rounded-full" onClick={share}>
          <Share2 size={15} /> Share
        </Button>
      </div>

      {/* Lime billboard */}
      <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-primary-foreground/10" />
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-32 size-64 rounded-full border border-primary-foreground/10" />

        <div className="relative flex items-center gap-2">
          <span className="min-w-0 truncate rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-semibold">
            {event.organizationName}
          </span>
          <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', STATUS_STYLE[event.status])}>
            {event.status}
          </span>
        </div>

        <h1 className="relative mt-4 text-3xl font-bold tracking-tight">{event.name}</h1>

        {isCancelled && (
          <p className="relative mt-3 rounded-xl bg-primary-foreground/10 px-3 py-2 text-sm">
            This event has been cancelled
            {event.cancellationReason ? ` — ${event.cancellationReason}` : '.'}
          </p>
        )}

        <div className="relative mt-2 flex items-center gap-2 text-xs font-medium text-primary-foreground/70">
          <Globe size={13} />
          {event.timezone}
        </div>
      </div>

      {/* When */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
          <Clock size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex flex-col gap-0.5">
            <span className="text-sm font-medium tabular-nums">
              {format(start, 'EEEE d MMMM')} · {format(start, 'HH:mm')}
              {end ? `–${format(end, 'HH:mm')}` : ''}
            </span>
            <span className="text-xs text-muted-foreground">{event.timezone}</span>
          </span>
        </div>

        {/* Where */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
          <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex flex-col gap-0.5">
            <span className={cn('text-sm font-medium', !event.location && 'text-muted-foreground')}>
              {event.location || 'No location set'}
            </span>
            <span className="text-xs text-muted-foreground">Offline location or virtual link</span>
          </span>
        </div>

        {/* Capacity — the server's number, not a subtraction done here */}
        {event.capacityRemaining !== null && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
            <Users size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">
              {isFull ? 'This event is full' : `${event.capacityRemaining} places left`}
            </span>
          </div>
        )}
      </div>

      {/* About */}
      {event.description && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            About
          </span>
          <p className="whitespace-pre-wrap rounded-2xl border border-border bg-card px-3.5 py-3 text-sm text-muted-foreground">
            {event.description}
          </p>
        </div>
      )}

      {/* Already registered but lost the link. Always answers the same way,
          registered or not — a different answer would leak the guest list. */}
      {!isEnded && (
        <button
          type="button"
          onClick={() => setResendOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          <MailQuestion size={13} /> Already registered but lost your pass?
        </button>
      )}

      {/* Sticky CTA. "Add to calendar" is absent, not broken: there is no ICS
          endpoint yet and the old client-side generator emitted invalid ICS. */}
      <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 bg-linear-to-t from-background via-background to-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
        {isEnded ? (
          <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground">
            <Clock size={15} /> {isCancelled ? 'This event was cancelled' : 'This event has ended'}
          </div>
        ) : isFull ? (
          <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground">
            <Users size={15} /> This event is full
          </div>
        ) : (
          <Button className="h-12 flex-1 rounded-full font-semibold" onClick={() => setRegisterOpen(true)}>
            <CalendarCheck /> Register
          </Button>
        )}
      </div>

      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} event={event} />
      <ResendPassDialog open={resendOpen} onOpenChange={setResendOpen} event={event} />
    </div>
  );
}

/**
 * Register, then hand over the pass.
 *
 * Registering never checks anyone in: an `attendance` row means someone actually
 * turned up, so it cannot be a side effect of filling in a form the night
 * before. Arrival happens on the pass screen or at a door.
 */
function RegisterDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicEvent;
}) {
  const navigate = useNavigate();
  const register = usePublicRegister(event.id);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Soft prefill: a signed-in, non-anonymous session already knows who this is,
  // so a returning attendee barely types.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (cancelled || !user || user.is_anonymous) return;
      const meta = (user.user_metadata ?? {}) as {
        full_name?: string; name?: string; first_name?: string; last_name?: string;
      };
      if (user.email) setEmail((prev) => prev || user.email!);
      const full = meta.full_name || meta.name || '';
      const [firstFromFull, ...rest] = full.trim().split(/\s+/);
      const first = meta.first_name || firstFromFull || '';
      const last = meta.last_name || rest.join(' ') || '';
      if (first) setFirstName((prev) => prev || first);
      if (last) setLastName((prev) => prev || last);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const canSubmit =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    !register.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const result = await register.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      toast.success("You're registered — here's your pass. Save it.");
      // The pass URL is the only copy. Take them to it rather than leaving them
      // on a confirmation they will close.
      navigate({ to: '/p/$token', params: { token: result.pass.token } });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not register you for this event'));
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Register"
      footer={
        <Button size="sm" className="rounded-full px-4" disabled={!canSubmit} onClick={submit}>
          <CalendarCheck /> {register.isPending ? 'Registering…' : 'Register'}
        </Button>
      }
      contentClassName="flex flex-col gap-3"
    >
      <div className="flex gap-2">
        <Input autoFocus placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11 rounded-xl" />
        <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11 rounded-xl" />
      </div>
      <Input type="email" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
      <p className="px-1 text-xs text-muted-foreground">
        {`Let the host know you’re coming to “${event.name}”. We'll show your pass on the next screen — save the link, it's the only copy.`}
      </p>
    </SheetDialog>
  );
}

/**
 * "Didn't get it?" — always 202, registered or not. The uniform answer is
 * deliberate: a different response for a known address would turn this into an
 * attendee-list oracle.
 */
function ResendPassDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PublicEvent;
}) {
  const resend = useResendPass(event.id);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const canSubmit = /.+@.+\..+/.test(email) && !resend.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await resend.mutateAsync(email.trim());
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not do that right now'));
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEmail('');
          setSent(false);
        }
      }}
      title="Find your pass"
      footer={
        sent ? (
          <Button size="sm" className="rounded-full px-4" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <Button size="sm" className="rounded-full px-4" disabled={!canSubmit} onClick={submit}>
            Send it again
          </Button>
        )
      }
      contentClassName="flex flex-col gap-3"
    >
      {sent ? (
        <p className="py-2 text-sm text-muted-foreground">
          If that address is registered for this event, the host has been asked to send the pass
          again. CredoPass does not send email itself yet — ask the host directly if nothing
          arrives.
        </p>
      ) : (
        <>
          <Input
            autoFocus
            type="email"
            inputMode="email"
            placeholder="you@email.com"
            value={email}
            className="h-11 rounded-xl"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <p className="px-1 text-xs text-muted-foreground">
            Enter the address you registered with.
          </p>
        </>
      )}
    </SheetDialog>
  );
}

function PublicEventMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card">{icon}</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action && (
          <Button className="mt-1 rounded-full" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
