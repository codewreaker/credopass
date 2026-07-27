/**
 * Onboarding — the first thing a new account sees, and a prerequisite for
 * everything else.
 *
 * Tenancy is enforced now: an account that belongs to no organization gets an
 * empty page from `GET /events`, correctly. Without somewhere to land, enforcing
 * tenancy would break the product for every new user — so this is where the
 * console sends them instead (API-SECOND-REBUILD §2.2).
 *
 * Three steps. Only the first is required; a host who just wants to get to the
 * console can skip the rest and come back through the Account page.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  Check,
  Copy,
  Link2,
  Plus,
  UserPlus,
} from 'lucide-react';
import {
  hasProblemCode,
  ProblemCode,
  setActiveOrganizationId,
  useCreateEvent,
  useCreateInvitation,
  useCreateOrganization,
  type Role,
} from '@credopass/api-client';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@credopass/ui/components/select';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import CredoPassLogoIcon from '../../containers/LeftSidebar/brand-icon';
import { errorMessage } from '../../lib/errors';
import { useSession } from '../../contexts/session';

const STEPS = ['Organization', 'Team', 'First event'] as const;

/** `Kharis Church` → `kharis-church`. The server will reject a clash as 409 slug_taken. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

/**
 * A first suggestion for the organization name, so step 1 is one Enter press.
 *
 * D16 keeps creating an organization deliberate — an account that belongs to
 * nothing lands here rather than being handed a tenant it never asked for. This
 * is the cheap half of that trade: it removes the typing without creating an
 * organization (and an RLS-policied tenant) per anonymous visitor.
 *
 * Skipped for guests, whose display name is a generated `Guest 4821` label
 * (`guestDisplayName` in services/core/src/services/identity.ts) and would read
 * as noise rather than as a suggestion.
 */
const suggestedOrganizationName = (
  displayName: string | null | undefined,
  isGuest: boolean
): string => {
  if (isGuest) return '';
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `${first}'s organization` : '';
};

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Everything except billing and deleting the org' },
  { value: 'organizer', label: 'Organizer', hint: 'Runs events and manages attendees' },
  { value: 'checkin', label: 'Check-in', hint: 'Works the door, nothing else' },
  { value: 'viewer', label: 'Viewer', hint: 'Read only' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');

  const goToConsole = () => navigate({ to: '/events' });

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-5 py-10">
      {/* Brand lockup — the only chrome on this page */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CredoPassLogoIcon className="size-8 bg-transparent!" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">CredoPass</span>
      </div>

      {/* Step rail */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                'h-1 rounded-full transition-colors duration-200',
                index <= step ? 'bg-primary' : 'bg-border'
              )}
            />
            <span
              className={cn(
                'text-[11px] font-medium uppercase tracking-widest',
                index <= step ? 'text-primary' : 'text-muted-foreground/60'
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <CreateOrganizationStep
          onCreated={(id, name) => {
            setOrganizationId(id);
            setOrganizationName(name);
            setStep(1);
          }}
        />
      )}

      {step === 1 && organizationId && (
        <InviteTeamStep
          organizationId={organizationId}
          organizationName={organizationName}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && <FirstEventStep onDone={goToConsole} />}
    </div>
  );
}

// ============================================================================
// Step 1 — create the organization
// ============================================================================

function CreateOrganizationStep({
  onCreated,
}: {
  onCreated: (id: string, name: string) => void;
}) {
  const { context } = useSession();
  // `null` means "untouched, show the suggestion". Derived rather than seeded
  // into state by an effect: the account arrives with `/me/context`, which may
  // still be in flight on first render, and writing state from an effect to
  // catch that would cascade renders. Once the host types, their value wins —
  // including an empty one.
  const [typed, setTyped] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(browserTimezone);
  const createOrganization = useCreateOrganization();

  const name =
    typed ??
    suggestedOrganizationName(context?.account.displayName, context?.account.isGuest ?? false);

  const slug = useMemo(() => slugify(name), [name]);
  const canSubmit = name.trim().length > 1 && !createOrganization.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      // Creating an organization makes you its owner in the same transaction,
      // so there is no separate "join" step to get wrong.
      const organization = await createOrganization.mutateAsync({
        name: name.trim(),
        slug,
        timezone,
      });
      setActiveOrganizationId(organization.id);
      onCreated(organization.id, organization.name);
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.SLUG_TAKEN)
          ? 'That web address is taken — try a slightly different name.'
          : errorMessage(error, 'Could not create the organization')
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome. Create your organization.</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Everything — events, attendees, your team — lives inside it. You can create more later.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Name
        </span>
        <Input
          autoFocus
          value={name}
          placeholder="Kharis Church"
          className="h-11 rounded-xl"
          // Select-all on focus so the suggestion is one keystroke to replace
          // and one Enter to accept.
          onFocus={(e) => e.target.select()}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        {slug && (
          <span className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Link2 size={12} />
            credopass.com/<span className="font-mono text-foreground">{slug}</span>
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Timezone
        </span>
        <Input
          value={timezone}
          className="h-11 rounded-xl"
          onChange={(e) => setTimezone(e.target.value)}
        />
        <span className="px-1 text-xs text-muted-foreground">
          Event times are shown in this zone by default.
        </span>
      </label>

      <Button
        className="h-11 gap-2 rounded-full font-semibold"
        disabled={!canSubmit}
        onClick={submit}
      >
        <Building2 size={16} />
        {createOrganization.isPending ? 'Creating…' : 'Create organization'}
      </Button>
    </div>
  );
}

// ============================================================================
// Step 2 — invite the team
// ============================================================================

interface SentInvitation {
  email: string;
  role: Role;
  url: string;
}

function InviteTeamStep({
  organizationId,
  organizationName,
  onNext,
}: {
  organizationId: string;
  organizationName: string;
  onNext: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('organizer');
  const [sent, setSent] = useState<SentInvitation[]>([]);
  const createInvitation = useCreateInvitation(organizationId);

  const canSend = /.+@.+\..+/.test(email) && !createInvitation.isPending;

  const send = async () => {
    if (!canSend) return;
    try {
      const invitation = await createInvitation.mutateAsync({ email: email.trim(), role });
      // The token comes back once. There is no email service yet, so the link is
      // the only way this invitation reaches anyone (§1.6).
      setSent((current) => [
        ...current,
        {
          email: invitation.email,
          role: invitation.role,
          url: `${window.location.origin}/invitations/${invitation.token}`,
        },
      ]);
      setEmail('');
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.ALREADY_MEMBER)
          ? 'They are already in this organization.'
          : errorMessage(error, 'Could not create the invitation')
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invite your team</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Who else works the door or runs events at {organizationName}?
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          autoFocus
          type="email"
          inputMode="email"
          placeholder="colleague@email.com"
          value={email}
          className="h-11 flex-1 rounded-xl"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <Select value={role} onValueChange={(v) => setRole((v as Role) ?? 'organizer')}>
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11 gap-1.5 rounded-xl"
          disabled={!canSend}
          onClick={send}
        >
          <Plus size={15} /> Add
        </Button>
      </div>

      {sent.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/25 bg-card p-3">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            Send these links yourself
          </p>
          <p className="px-1 text-xs text-muted-foreground">
            CredoPass does not send email yet. Copy each link and pass it on — it is the only
            copy.
          </p>
          {sent.map((invitation) => (
            <InvitationLinkRow key={invitation.url} invitation={invitation} />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" className="h-11 flex-1 rounded-full" onClick={onNext}>
          Skip for now
        </Button>
        <Button className="h-11 flex-1 gap-2 rounded-full font-semibold" onClick={onNext}>
          <UserPlus size={16} /> Continue
        </Button>
      </div>
    </div>
  );
}

function InvitationLinkRow({ invitation }: { invitation: SentInvitation }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{invitation.url}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
        {invitation.role}
      </span>
      <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={copy}>
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </Button>
    </div>
  );
}

// ============================================================================
// Step 3 — the first event
// ============================================================================

/** `2026-07-27T19:00` in local time, for a `datetime-local` default. */
const defaultStart = () => {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
};

function FirstEventStep({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startAt, setStartAt] = useState(defaultStart);
  const [locationText, setLocationText] = useState('');
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const createEvent = useCreateEvent();

  const canSubmit =
    name.trim().length > 1 && locationText.trim().length > 0 && !!startAt && !createEvent.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      // `endAt` is optional — the server writes start + 1h when it is omitted,
      // so the form does not have to invent a duration.
      const event = await createEvent.mutateAsync({
        name: name.trim(),
        startAt: new Date(startAt).toISOString(),
        locationText: locationText.trim(),
        timezone: browserTimezone(),
      });
      setCreated({ id: event.id, name: event.name });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the event'));
    }
  };

  if (created) {
    const shareUrl = `${window.location.origin}/e/${created.id}`;
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{created.name} is live</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Share this link and people can register themselves.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-xs">{shareUrl}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied');
              } catch {
                toast.error('Could not copy the link');
              }
            }}
          >
            <Copy size={14} />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full"
            onClick={() => navigate({ to: '/events/$eventId', params: { eventId: created.id } })}
          >
            Open the event
          </Button>
          <Button className="h-11 flex-1 gap-2 rounded-full font-semibold" onClick={onDone}>
            Go to console <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your first event</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You can change any of this later. Nobody sees it until you share the link.
        </p>
      </div>

      <Input
        autoFocus
        value={name}
        placeholder="Sunday Service"
        className="h-11 rounded-xl"
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        type="datetime-local"
        value={startAt}
        className="h-11 rounded-xl"
        onChange={(e) => setStartAt(e.target.value)}
      />
      <Input
        value={locationText}
        placeholder="Main hall"
        className="h-11 rounded-xl"
        onChange={(e) => setLocationText(e.target.value)}
      />

      <div className="flex gap-2">
        <Button variant="ghost" className="h-11 flex-1 rounded-full" onClick={onDone}>
          Skip for now
        </Button>
        <Button
          className="h-11 flex-1 gap-2 rounded-full font-semibold"
          disabled={!canSubmit}
          onClick={submit}
        >
          <CalendarPlus size={16} />
          {createEvent.isPending ? 'Creating…' : 'Create event'}
        </Button>
      </div>
    </div>
  );
}

