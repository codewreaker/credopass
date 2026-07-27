/**
 * `/invitations/$token` — accepting an invitation to an organization.
 *
 * Three failures matter and they mean genuinely different things, so each gets
 * its own screen rather than a generic error (§2.2):
 *
 *   403 invitation_mismatch  the invitation was sent to another address
 *   410 expired              it was real, it has run out
 *   404                      wrong link, or already used
 *
 * Acceptance requires a **verified** email matching the invitation, so a
 * signed-out visitor is sent to sign in first and returned here afterwards.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, MailWarning } from 'lucide-react';
import {
  isApiError,
  ProblemCode,
  setActiveOrganizationId,
  useAcceptInvitation,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';
import { useSession } from '../../contexts/session';

type Outcome =
  | { kind: 'working' }
  | { kind: 'accepted'; organizationId: string; role: string }
  | { kind: 'mismatch' }
  | { kind: 'expired' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export default function AcceptInvitationPage() {
  const { token } = useParams({ from: '/invitations/$token' });
  const navigate = useNavigate();
  const { session, isAuthLoading, context } = useSession();
  const acceptInvitation = useAcceptInvitation();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'working' });

  useEffect(() => {
    if (isAuthLoading) return;

    if (!session) {
      navigate({
        to: '/login',
        search: { view: 'social', redirect: `/invitations/${token}` },
        replace: true,
      });
      return;
    }

    let cancelled = false;
    acceptInvitation
      .mutateAsync(token)
      .then((result) => {
        if (cancelled) return;
        setActiveOrganizationId(result.organizationId);
        setOutcome({ kind: 'accepted', organizationId: result.organizationId, role: result.role });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isApiError(error)) {
          if (error.code === ProblemCode.INVITATION_MISMATCH) return setOutcome({ kind: 'mismatch' });
          if (error.status === 410) return setOutcome({ kind: 'expired' });
          if (error.status === 404) return setOutcome({ kind: 'missing' });
          return setOutcome({ kind: 'error', message: error.detail ?? error.title });
        }
        setOutcome({ kind: 'error', message: 'Something went wrong.' });
      });

    return () => {
      cancelled = true;
    };
    // Accept exactly once per token — re-running on every render would burn the
    // invitation and then report it missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session, isAuthLoading]);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CredoPassLogoIcon className="size-8 bg-transparent!" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
      </div>

      {outcome.kind === 'working' && (
        <Panel
          icon={<div className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" />}
          title="Checking your invitation…"
          body="One moment."
        />
      )}

      {outcome.kind === 'accepted' && (
        <Panel
          icon={<CheckCircle2 className="size-6 text-success" />}
          title="You're in"
          body={`You joined as ${outcome.role}. Everything is scoped to this organization from here.`}
          action={
            <Button className="h-11 gap-2 rounded-full font-semibold" onClick={() => navigate({ to: '/events' })}>
              Go to events <ArrowRight size={16} />
            </Button>
          }
        />
      )}

      {outcome.kind === 'mismatch' && (
        <Panel
          icon={<MailWarning className="size-6 text-primary" />}
          title="This invitation is for a different address"
          body={
            context?.account.email
              ? `You are signed in as ${context.account.email}. Sign in with the address the invitation was sent to, then open this link again.`
              : 'Sign in with the address the invitation was sent to, then open this link again.'
          }
          action={
            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={() =>
                navigate({
                  to: '/login',
                  search: { view: 'email', out: true, redirect: `/invitations/${token}` },
                })
              }
            >
              Sign in with another address
            </Button>
          }
        />
      )}

      {outcome.kind === 'expired' && (
        <Panel
          icon={<Clock className="size-6 text-muted-foreground" />}
          title="This invitation has expired"
          body="Ask whoever invited you to send a new one — invitations are short-lived on purpose."
        />
      )}

      {outcome.kind === 'missing' && (
        <Panel
          icon={<AlertCircle className="size-6 text-muted-foreground" />}
          title="We can't find this invitation"
          body="The link may be incomplete, or it has already been used. Ask for a fresh one."
        />
      )}

      {outcome.kind === 'error' && (
        <Panel
          icon={<AlertCircle className="size-6 text-destructive" />}
          title="That didn't work"
          body={outcome.message}
        />
      )}
    </div>
  );
}

function Panel({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted">{icon}</div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-1 flex">{action}</div>}
    </div>
  );
}
