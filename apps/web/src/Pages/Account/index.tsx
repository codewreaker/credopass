/**
 * `/account` — one page for everything that is about *you* and *your
 * organization*, replacing `/profile` and `/organizations` (§2.9).
 *
 * Two rules run through all of it:
 *
 *  1. **Every control is permission-gated from `meContext.membership.permissions`.**
 *     If the caller can't do it, the control isn't rendered. Never show a button
 *     that will come back 403.
 *  2. **Two 409s are handled, not discovered.** `last_owner` — an organization
 *     needs an owner, so the only one can neither be demoted nor removed.
 *     `has_events` — an organization with events cannot be deleted. Both are
 *     explained in place rather than surfacing as a failed request.
 */

import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Building2,
  Check,
  Copy,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import {
  clearActiveOrganization,
  hasProblemCode,
  ProblemCode,
  setActiveOrganizationId,
  useDeleteOrganization,
  useInvitations,
  useMembers,
  useOrganizations,
  useCreateInvitation,
  useCreateOrganization,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
  useUpdateOrganization,
  type Member,
  type Role,
} from '@credopass/api-client';
import { Avatar, AvatarFallback } from '@credopass/ui/components/avatar';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@credopass/ui/components/select';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { supabase } from '../../supabase';
import { useCan, useSession } from '../../contexts/session';
import { errorMessage } from '../../lib/errors';

export const ACCOUNT_TABS = [
  'profile',
  'organizations',
  'members',
  'settings',
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

const TAB_LABELS: Record<AccountTab, { label: string; icon: typeof UserRound }> = {
  profile: { label: 'Profile', icon: UserRound },
  organizations: { label: 'Organizations', icon: Building2 },
  members: { label: 'Members', icon: Users },
  settings: { label: 'Settings', icon: Settings },
};

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'checkin', label: 'Check-in' },
  { value: 'viewer', label: 'Viewer' },
];

export default function AccountPage() {
  const navigate = useNavigate();
  const { tab } = useSearch({ from: '/account' });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          You, your organizations, and who else can get in.
        </p>
      </div>

      {/* Tabs as pills, matching the rest of the console's controls */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-3">
        {ACCOUNT_TABS.map((key) => {
          const { label, icon: Icon } = TAB_LABELS[key];
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate({ to: '/account', search: { tab: key }, replace: true })}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'organizations' && <OrganizationsTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// Profile
// ============================================================================

function ProfileTab() {
  const navigate = useNavigate();
  const { context } = useSession();
  const account = context?.account;

  const initials = (account?.displayName || account?.email || 'CP')
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Profile"
        // PATCH /me does not exist yet (§1.6). Saying so beats a disabled field
        // with no explanation.
        description="Read-only for now — editing your profile isn't built yet."
      >
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {account?.displayName || account?.email?.split('@')[0] || 'Your account'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{account?.email ?? '—'}</p>
          </div>
        </div>
        {/*
          The guest banner is gone with anonymous sign-in. It offered to "create
          a real account to keep your organizations" — an action that was never
          built, so it promised a rescue that did not exist.
        */}
      </Section>

      <Section title="Session" description="Sign out of this browser.">
        <Button
          variant="outline"
          className="w-fit gap-2 rounded-full text-destructive hover:text-destructive"
          onClick={async () => {
            await supabase.auth.signOut();
            clearActiveOrganization();
            navigate({ to: '/login', search: { view: 'social', out: true } });
          }}
        >
          <LogOut size={15} /> Sign out
        </Button>
      </Section>
    </div>
  );
}

// ============================================================================
// Organizations
// ============================================================================

function OrganizationsTab() {
  const { organizationId } = useSession();
  const { data: organizations = [], isLoading } = useOrganizations();
  const [creating, setCreating] = useState(false);

  return (
    <Section
      title="Your organizations"
      description="Only the ones you belong to. Switching here re-scopes the whole console."
      action={
        <>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} /> New
          </Button>
          <NewOrganizationDialog open={creating} onOpenChange={setCreating} />
        </>
      }
    >
      {isLoading ? (
        <p className="py-2 text-xs text-muted-foreground">Loading…</p>
      ) : organizations.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          You do not belong to any organization yet.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {organizations.map((org) => {
            const active = org.id === organizationId;
            return (
              <div key={org.id} className="flex items-center gap-3 py-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-semibold">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{org.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {org.role ? `${org.role} · ` : ''}
                    {org.plan}
                  </p>
                </div>
                {active ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    Active
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setActiveOrganizationId(org.id)}
                  >
                    Switch
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/**
 * Creating an organization is one field and one POST (D23).
 *
 * It used to be step 1 of a three-step wizard whose last step was "create your
 * first event" — so the only route to a second organization ran through an
 * event form, for no reason the API ever required. `POST /organizations` has
 * always stood alone.
 *
 * The plan cap is not computed here. The server owns the number (it moves with
 * pricing) and answers `402 plan_limit` with a sentence naming it, which is
 * rendered verbatim.
 */
function NewOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const createOrganization = useCreateOrganization();
  const canSubmit = name.trim().length > 1 && !createOrganization.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const organization = await createOrganization.mutateAsync({ name: name.trim() });
      // Switch to it. Creating an organization you are then not looking at is a
      // confusing outcome, and `POST /organizations` already made you its owner.
      setActiveOrganizationId(organization.id);
      toast.success(`${organization.name} created`);
      setName('');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create that organization'));
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New organization"
      footer={
        <Button size="sm" className="rounded-full px-4" disabled={!canSubmit} onClick={submit}>
          {createOrganization.isPending ? 'Creating…' : 'Create'}
        </Button>
      }
      contentClassName="flex flex-col gap-3"
    >
      <Input
        autoFocus
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="h-11 rounded-xl"
      />
      <p className="text-xs text-muted-foreground">
        You will be its owner. Its web address is generated from the name and can be changed in
        Settings.
      </p>
    </SheetDialog>
  );
}

// ============================================================================
// Members and invitations
// ============================================================================

function MembersTab() {
  const { organizationId } = useSession();
  const canRead = useCan('member:read');
  const canInvite = useCan('member:invite');
  const canUpdateRole = useCan('member:update_role');
  const canRemove = useCan('member:remove');

  const { data: members = [] } = useMembers(canRead ? (organizationId ?? undefined) : undefined);
  const { data: invitations = [] } = useInvitations(
    canInvite ? (organizationId ?? undefined) : undefined
  );

  const updateRole = useUpdateMemberRole(organizationId ?? '');
  const removeMember = useRemoveMember(organizationId ?? '');
  const revokeInvitation = useRevokeInvitation(organizationId ?? '');

  // Whether *this* member is the last owner is a fact about the list, and the
  // list is right here — so the control can be disabled with a reason instead of
  // firing a request that comes back 409.
  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const isLastOwner = (member: Member) => member.role === 'owner' && ownerCount === 1;

  if (!organizationId) {
    return (
      <Section title="Members">
        <p className="py-2 text-xs text-muted-foreground">Pick an organization first.</p>
      </Section>
    );
  }

  if (!canRead) {
    return (
      <Section title="Members">
        <p className="py-2 text-xs text-muted-foreground">
          Your role does not let you see who else is in this organization.
        </p>
      </Section>
    );
  }

  const changeRole = async (member: Member, role: Role) => {
    try {
      await updateRole.mutateAsync({ accountId: member.accountId, role });
      toast.success(`${member.displayName ?? member.email} is now ${role}`);
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.LAST_OWNER)
          ? 'An organization needs at least one owner.'
          : errorMessage(error, 'Could not change that role')
      );
    }
  };

  const remove = async (member: Member) => {
    try {
      await removeMember.mutateAsync(member.accountId);
      toast.success('Member removed');
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.LAST_OWNER)
          ? 'An organization needs at least one owner.'
          : errorMessage(error, 'Could not remove that member')
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section title="Members" description="Who can get into this organization, and as what.">
        <div className="flex flex-col divide-y divide-border/60">
          {members.map((member) => {
            const lastOwner = isLastOwner(member);
            return (
              <div key={member.accountId} className="flex items-center gap-3 py-2.5">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-[10px] font-semibold">
                    {(member.displayName || member.email || '?').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.displayName || member.email || 'Unknown'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>

                {canUpdateRole && !lastOwner ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) => v && changeRole(member, v as Role)}
                  >
                    <SelectTrigger className="h-8 w-32 shrink-0 rounded-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground"
                    title={lastOwner ? 'The only owner cannot be demoted' : undefined}
                  >
                    {member.role}
                  </span>
                )}

                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={lastOwner}
                    title={lastOwner ? 'The only owner cannot be removed' : 'Remove'}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(member)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {ownerCount === 1 && (
          <p className="text-xs text-muted-foreground">
            <ShieldCheck size={12} className="mr-1 inline" />
            An organization needs at least one owner, so the only one cannot be demoted or removed.
          </p>
        )}
      </Section>

      {canInvite && (
        <InvitationsSection
          organizationId={organizationId}
          invitations={invitations}
          onRevoke={async (id) => {
            try {
              await revokeInvitation.mutateAsync(id);
              toast.success('Invitation revoked');
            } catch (error) {
              toast.error(errorMessage(error, 'Could not revoke that invitation'));
            }
          }}
        />
      )}
    </div>
  );
}

function InvitationsSection({
  organizationId,
  invitations,
  onRevoke,
}: {
  organizationId: string;
  invitations: { id: string; email: string; role: Role; expiresAt: string }[];
  onRevoke: (invitationId: string) => void;
}) {
  const createInvitation = useCreateInvitation(organizationId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('organizer');
  // The token is returned once, so the link it forms only exists in this
  // component's state. Refreshing the page loses it — which is why the copy says
  // to send it now.
  const [links, setLinks] = useState<Record<string, string>>({});

  const canSend = /.+@.+\..+/.test(email) && !createInvitation.isPending;

  const send = async () => {
    if (!canSend) return;
    try {
      const invitation = await createInvitation.mutateAsync({ email: email.trim(), role });
      setLinks((current) => ({
        ...current,
        [invitation.id]: `${window.location.origin}/invitations/${invitation.token}`,
      }));
      setEmail('');
      toast.success('Invitation created — copy the link and send it');
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.ALREADY_MEMBER)
          ? 'They are already in this organization.'
          : errorMessage(error, 'Could not create that invitation')
      );
    }
  };

  return (
    <Section
      title="Invitations"
      description="CredoPass does not send email yet — copy each link and pass it on yourself."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          placeholder="colleague@email.com"
          value={email}
          className="h-10 flex-1 rounded-xl"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <Select value={role} onValueChange={(v) => setRole((v as Role) ?? 'organizer')}>
          <SelectTrigger className="h-10 w-full rounded-xl sm:w-36">
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
        <Button variant="outline" className="h-10 gap-1.5 rounded-xl" disabled={!canSend} onClick={send}>
          <Plus size={15} /> Invite
        </Button>
      </div>

      {invitations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No invitations outstanding.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invitation.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {invitation.role} · expires{' '}
                  {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
              {links[invitation.id] ? (
                <CopyLinkButton url={links[invitation.id]} />
              ) : (
                <span
                  className="shrink-0 text-[11px] text-muted-foreground"
                  title="The token is shown once, when the invitation is created"
                >
                  link not shown
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRevoke(invitation.id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5 rounded-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error('Could not copy the link');
        }
      }}
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

// ============================================================================
// Organization settings
// ============================================================================

function SettingsTab() {
  const navigate = useNavigate();
  const { organizationId } = useSession();
  const canUpdate = useCan('org:update');
  const canDelete = useCan('org:delete');

  const { data: organizations = [] } = useOrganizations();
  const organization = organizations.find((o) => o.id === organizationId);

  const updateOrganization = useUpdateOrganization(organizationId ?? '');
  const deleteOrganization = useDeleteOrganization();

  const [name, setName] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  if (!organization) {
    return (
      <Section title="Organization settings">
        <p className="py-2 text-xs text-muted-foreground">Pick an organization first.</p>
      </Section>
    );
  }

  const currentName = name ?? organization.name;
  const currentSlug = slug ?? organization.slug;
  const dirty = currentName !== organization.name || currentSlug !== organization.slug;

  const save = async () => {
    try {
      await updateOrganization.mutateAsync({ name: currentName, slug: currentSlug });
      toast.success('Organization updated');
      setName(null);
      setSlug(null);
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.SLUG_TAKEN)
          ? 'That web address is already taken.'
          : errorMessage(error, 'Could not save those changes')
      );
    }
  };

  const remove = async () => {
    try {
      await deleteOrganization.mutateAsync(organization.id);
      clearActiveOrganization();
      toast.success(`${organization.name} deleted`);
      // Stay put. The Organizations tab is where the remaining ones are, and
      // where a new one is made — there is no onboarding screen to land on.
      navigate({ to: '/account', search: { tab: 'organizations' } });
    } catch (error) {
      toast.error(
        hasProblemCode(error, ProblemCode.HAS_EVENTS)
          ? 'This organization still has events. Delete or cancel them first.'
          : errorMessage(error, 'Could not delete this organization')
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Section title="Organization" description="Name and web address.">
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Name
          </span>
          <Input
            value={currentName}
            disabled={!canUpdate}
            className="h-10 rounded-xl"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Web address
          </span>
          <Input
            value={currentSlug}
            disabled={!canUpdate}
            className="h-10 rounded-xl font-mono"
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        {canUpdate && (
          <Button
            className="w-fit rounded-full"
            disabled={!dirty || updateOrganization.isPending}
            onClick={save}
          >
            Save changes
          </Button>
        )}
      </Section>

      {canDelete && (
        <Section
          title="Delete this organization"
          description="Only possible while it has no events — otherwise its attendance history would go with it."
        >
          <Button
            variant="outline"
            className="w-fit gap-2 rounded-full text-destructive hover:text-destructive"
            disabled={deleteOrganization.isPending}
            onClick={remove}
          >
            <Trash2 size={15} /> Delete {organization.name}
          </Button>
        </Section>
      )}

      {/* SSO, verified domains and billing all have schema but no endpoints yet
          (Phase 7). Naming them is more useful than an empty tab. */}
      <Section title="Coming later" description="Built in the schema, not yet reachable from here.">
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          <li>· Single sign-on providers and verified email domains</li>
          <li>· Billing and plan changes — currently {organization.plan}</li>
        </ul>
      </Section>
    </div>
  );
}
