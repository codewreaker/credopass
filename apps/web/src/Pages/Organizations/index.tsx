import React, { useCallback, useMemo, useState } from 'react';
import { count, useLiveQuery } from '@tanstack/react-db';

import {
  Building2,
  Plus,
  Users,
  Calendar,
  Settings,
  Crown,
  Sparkles,
  Zap,
  Building,
  Check,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { getCollections } from '@credopass/api-client/collections';
import { useOrganizationStore, useLauncher } from '@credopass/lib/stores';
import type { Organization, OrgPlan } from '@credopass/lib/schemas';
import { useToolbarContext } from '@credopass/lib/hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@credopass/ui/components/card';
import { Button } from '@credopass/ui/components/button';
import { Badge } from '@credopass/ui/components/badge';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { launchOrganizationForm } from '../../containers/OrganizationForm';
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { useNavigate } from '@tanstack/react-router';

// Plan configuration
const planConfig: Record<OrgPlan, { color: string; icon: React.ElementType; label: string; description: string }> = {
  free: { color: 'secondary', icon: Building, label: 'Free', description: 'Basic features' },
  starter: { color: 'default', icon: Zap, label: 'Starter', description: 'Extended limits' },
  pro: { color: 'default', icon: Sparkles, label: 'Pro', description: 'Analytics & more' },
  enterprise: { color: 'default', icon: Crown, label: 'Enterprise', description: 'Custom solutions' },
};

// Organization Card Component
interface OrgCardProps {
  org: Organization & { members?: number; events?: number; };
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  eventCount?: number;
  memberCount?: number;
}

const OrganizationCard: React.FC<OrgCardProps> = ({ org, isActive, onSelect, onEdit, eventCount, memberCount }) => {
  const plan = planConfig[org.plan] || planConfig.free;
  const PlanIcon = plan.icon;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 group ${
        isActive
          ? 'border-0 bg-primary text-primary-foreground shadow-[0_0_32px_-8px] shadow-primary/25'
          : 'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-elevation-2'
      }`}
    >
      {isActive && (
        <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-[14px] border-primary-foreground/8" />
      )}
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <CardTitle className={`text-lg tracking-tight flex items-center gap-2 ${isActive ? '' : 'group-hover:text-primary transition-colors'}`}>
                {org.name}
                {isActive && <Check className="w-4 h-4" />}
              </CardTitle>
              <CardDescription className={`text-sm ${isActive ? 'text-primary-foreground/60' : ''}`}>/{org.slug}</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 rounded-full ${isActive ? 'border-primary-foreground/25 text-primary-foreground bg-primary-foreground/10' : 'border-primary/30 text-primary bg-primary/10'}`}
          >
            <PlanIcon className="w-3 h-3" />
            {plan.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 relative z-10">
        <div className="space-y-3">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isActive ? 'bg-primary-foreground/10' : 'bg-muted/30'}`}>
              <Users className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
              <span className={`text-xs tabular-nums font-medium ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{memberCount ?? 0} members</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isActive ? 'bg-primary-foreground/10' : 'bg-muted/30'}`}>
              <Calendar className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
              <span className={`text-xs tabular-nums font-medium ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{eventCount ?? 0} events</span>
            </div>
          </div>

          {/* External Auth Indicator */}
          {org.externalAuthEndpoint && (
            <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${isActive ? 'text-primary-foreground/70 bg-primary-foreground/10' : 'text-muted-foreground bg-muted/50'}`}>
              <ExternalLink className="w-3 h-3" />
              External auth configured
            </div>
          )}

          {/* Stripe Indicator */}
          {org.stripeCustomerId && (
            <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${isActive ? 'text-primary-foreground/70 bg-primary-foreground/10' : 'text-muted-foreground bg-muted/50'}`}>
              <CreditCard className="w-3 h-3" />
              Billing active
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className={`flex-1 rounded-full font-semibold ${
                isActive
                  ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                  : 'bg-transparent border border-border text-foreground hover:border-primary/50 hover:bg-primary/5'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              {isActive ? 'Active workspace' : 'Switch to this org'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full ${isActive ? 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Header Component
interface HeaderProps {
  orgCount: number;
  onCreateNew: () => void;
}

const PageHeader: React.FC<HeaderProps> = ({ orgCount, onCreateNew }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="flex flex-col gap-0.5">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      <p className="text-sm text-muted-foreground">
        Manage your organizations and switch between them
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="tabular-nums rounded-full">
        {orgCount} {orgCount === 1 ? 'org' : 'orgs'}
      </Badge>
      <Button onClick={onCreateNew} size="sm" className="rounded-full font-semibold">
        <Plus className="w-3.5 h-3.5" />
        New Organization
      </Button>
    </div>
  </div>
);

// Main Organizations Page
// `embedded` = rendered inside the Profile page: skip the standalone header,
// toolbar registration and Pro banner (Profile owns those).
const OrganizationsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { openLauncher } = useLauncher();
  const navigate = useNavigate();
  const { activeOrganizationId, setActiveOrganization } = useOrganizationStore();
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Get collections inside component
  const {
    organizations: organizationCollection,
    events: eventCollection,
    orgMemberships: orgMembershipCollection,
  } = getCollections();

  const handleCreateNew = useCallback(() => {
    launchOrganizationForm({}, openLauncher);
  }, [openLauncher]);

  // Register toolbar context: secondary "Add Organization" button + search.
  // When embedded in Profile, the parent page owns the toolbar, so opt out.
  useToolbarContext(embedded ? {} : {
    action: { icon: Building2, label: 'New Organization', onClick: handleCreateNew },
    search: { enabled: true, placeholder: 'Search organizations\u2026', onSearch:setSearchQuery },
  });



  const orgsQuery = useLiveQuery((query) =>
    query
      .from({ organizationCollection })
  );

  // Count events grouped by organizationId
  const eventCount = useLiveQuery((q) =>
    q
      .from({ ev: eventCollection })
      .groupBy(({ ev }) => ev.organizationId)
      .select(({ ev }) => ({
        organizationId: ev.organizationId,
        eventCount: count(ev.id),
      }))
  ).data;

  // Count members grouped by organizationId (replaces the old '--' placeholder)
  const memberCount = useLiveQuery((q) =>
    q
      .from({ m: orgMembershipCollection })
      .groupBy(({ m }) => m.organizationId)
      .select(({ m }) => ({
        organizationId: m.organizationId,
        memberCount: count(m.id),
      }))
  ).data;


  const organizations = (orgsQuery.data ?? []);

  // Filter organizations by search query
  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter(
      (org: Organization) =>
        org.name?.toLowerCase().includes(q) ||
        org.slug?.toLowerCase().includes(q) ||
        org.plan?.toLowerCase().includes(q),
    );
  }, [organizations, searchQuery]);

  const handleSelectOrganization = (org: Organization) => {
    setActiveOrganization(org.id, org);
  };

  const handleEditOrganization = (org: Organization) => {
    launchOrganizationForm({
      initialData: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
      },
      isEditing: true
    }, openLauncher);
  };

  // Loading state: skeleton cards instead of flashing the empty state
  if (orgsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {!embedded && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
        )}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${embedded ? '' : 'xl:grid-cols-3'} gap-4`}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (organizations.length === 0) {
    return (
      <EmptyState
        title="No organizations yet"
        description="Create your first organization to get started with attendance tracking."
        icon={<Building2 className="h-10 w-10" />}
        action={{ label: "Create Organization", onClick: handleCreateNew }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <>
          <PageHeader orgCount={filteredOrganizations.length} onCreateNew={handleCreateNew} />
          <UpgradeCTA
            size="lg"
            title="Take your organization Pro"
            description="Unlimited events, advanced analytics and priority support for your whole team."
            onClick={() => navigate({ to: '/upgrade' })}
          />
        </>
      )}

      {embedded && (
        <div className="flex justify-end">
          <Button onClick={handleCreateNew} size="sm" variant="outline" className="rounded-full font-semibold gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Organization
          </Button>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 ${embedded ? '' : 'xl:grid-cols-3'} gap-4`}>
        {filteredOrganizations.map((org: Organization) => (
          <OrganizationCard
            key={org.id}
            org={org}
            eventCount={eventCount?.find(ec => ec.organizationId === org.id)?.eventCount || 0}
            memberCount={memberCount?.find(mc => mc.organizationId === org.id)?.memberCount || 0}
            isActive={org.id === activeOrganizationId}
            onSelect={() => handleSelectOrganization(org)}
            onEdit={() => handleEditOrganization(org)}
          />
        ))}
      </div>
    </div>
  );
};

export default OrganizationsPage;
