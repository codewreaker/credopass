/**
 * `/p/$token` — the pass. New, and the smallest screen in the product.
 *
 * Standalone: **no app shell, no nav, no sign-in prompt.** Someone opened a link
 * from a message. They have no account, belong to no organization, and asking
 * them to sign in to see a pass they already hold would be absurd.
 *
 * `GET /p/{token}` returns a first name and a last **initial** — never the
 * email. Do not add fields to this screen: the token is a bearer credential and
 * anyone who forwards the message forwards everything shown here (§2.8).
 *
 * `410` and `404` are calm states, not errors. The pass ran out, or the link is
 * wrong; either way the holder needs the organiser's name so they know who to
 * ask, and nothing else.
 */

import { Link, useParams } from '@tanstack/react-router';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock, MapPin, TicketX } from 'lucide-react';
import { format } from 'date-fns/format';
import { usePass, usePassCheckIn } from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { GlowingQRCode } from '@credopass/ui/components/glowing-qr-code';
import { toast } from '@credopass/ui/components/sonner';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';
import { errorMessage, isGone, isNotFound } from '../../lib/errors';

export default function PassPage() {
  const { token } = useParams({ from: '/p/$token' });
  const { data: view, isLoading, error } = usePass(token);
  const checkIn = usePassCheckIn(token);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!view) {
    const expired = isGone(error);
    return (
      <PassShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/10">
            <TicketX className="size-7" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {expired ? 'This pass is no longer valid' : 'We can’t find this pass'}
          </h1>
          <p className="text-sm text-primary-foreground/70">
            {expired || isNotFound(error)
              ? 'Ask the organiser to send you a new one.'
              : errorMessage(error)}
          </p>
        </div>
      </PassShell>
    );
  }

  const { pass, event, person, attendance, canSelfCheckIn } = view;
  const start = new Date(event.startAt);
  const isCheckedIn = attendance.state === 'attended';

  const doCheckIn = async () => {
    try {
      const result = await checkIn.mutateAsync();
      toast.success(result.alreadyRecorded ? 'You were already checked in' : "You're checked in");
    } catch (error) {
      toast.error(errorMessage(error, 'Could not check you in'));
    }
  };

  return (
    <PassShell>
      <div className="flex w-full flex-col items-center gap-5">
        {/* The code a door scans. White quiet zone preserved so it reads on any
            screen brightness. */}
        <div className="rounded-[2rem] bg-primary-foreground/25 p-5 shadow-2xl ring-1 ring-primary-foreground/15 backdrop-blur-xl">
          <GlowingQRCode
            value={pass.qrValue}
            size={230}
            showGlow={false}
            ariaLabel="Your event pass"
            className="rounded-[1.35rem] bg-primary-foreground"
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          {/* First name and last initial. That is all the API returns, and all
              this screen should ever show. */}
          <p className="text-2xl font-semibold tracking-tight">
            {person.firstName} {person.lastInitial}.
          </p>
          <p className="text-lg font-medium text-primary-foreground/90">{event.name}</p>
          <p className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/70">
            <Clock size={14} />
            {format(start, 'EEE d MMM')} · {format(start, 'HH:mm')}
          </p>
          {event.location && (
            <p className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/70">
              <MapPin size={14} />
              {event.organizationName}, {event.location}
            </p>
          )}
        </div>

        {isCheckedIn ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary">
            <CheckCircle2 size={15} /> Checked in
            {attendance.checkInTime
              ? ` at ${format(new Date(attendance.checkInTime), 'HH:mm')}`
              : ''}
          </div>
        ) : canSelfCheckIn ? (
          <Button
            className="h-12 w-full max-w-xs rounded-full bg-primary-foreground font-semibold text-primary hover:bg-primary-foreground/90"
            disabled={checkIn.isPending}
            onClick={doCheckIn}
          >
            <CalendarCheck size={16} />
            {checkIn.isPending ? 'Checking in…' : 'Check in'}
          </Button>
        ) : (
          <p className="max-w-xs text-center text-sm text-primary-foreground/70">
            Show this at the door — a host will scan it to check you in.
          </p>
        )}

        <p className="text-[11px] text-primary-foreground/45">
          Save this link. It is the only copy of your pass.
        </p>

        <SignUpNudge />
      </div>
    </PassShell>
  );
}

/**
 * The sign-up nudge (D25).
 *
 * Copy and a link. No endpoint, no lookup, and deliberately no branch on
 * whether this address already has an account — that would make the page an
 * oracle for "does this person use CredoPass", and through the event link, for
 * "is this person attending this event". The same reasoning makes
 * `POST /public/events/{id}/resend-pass` answer an identical `202` either way.
 *
 * It sits below the pass rather than in the register dialog, where it would
 * compete with the one action that matters. And it promises only what is built:
 * an account is somewhere to keep passes, not an email that will arrive —
 * there is no NotificationService, so no copy here may imply one.
 */
function SignUpNudge() {
  return (
    <div className="mt-2 w-full max-w-xs border-t border-primary-foreground/15 pt-4 text-center">
      <p className="text-xs leading-relaxed text-primary-foreground/70">
        Going to more of these? A free CredoPass account keeps every pass in one place, whoever is
        running the event.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        render={(props) => <Link {...props} to="/login" search={{ view: 'social' }} />}
      >
        Create a free account <ArrowRight size={14} />
      </Button>
    </div>
  );
}

/** The lime billboard the pass lives on. No nav, deliberately. */
function PassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden bg-primary px-5 py-10 text-primary-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border-28 border-primary-foreground/8" />
      <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-16 size-64 rounded-full border-22 border-primary-foreground/6" />

      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary">
          <CredoPassLogoIcon className="size-8 bg-transparent! text-primary!" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">{children}</div>
    </div>
  );
}
