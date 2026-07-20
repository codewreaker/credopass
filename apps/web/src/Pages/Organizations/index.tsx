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
      className={`cursor-pointer transition-all duration-150 group ${isActive ? 'ring-2 ring-primary border-primary' : 'hover:ring-1 hover:ring-border-strong hover:shadow-elevation-2'}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                {org.name}
                {isActive && <Check className="w-4 h-4 text-primary" />}
              </CardTitle>
              <CardDescription className="text-sm">/{org.slug}</CardDescription>
            </div>
          </div>
          <Badge variant={plan.color as any} className="flex items-center gap-1">
            <PlanIcon className="w-3 h-3" />
            {plan.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground tabular-nums">{memberCount ?? 0} members</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground tabular-nums">{eventCount ?? 0} events</span>
            </div>
          </div>

          {/* External Auth Indicator */}
          {org.externalAuthEndpoint && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              <ExternalLink className="w-3 h-3" />
              External auth configured
            </div>
          )}

          {/* Stripe Indicator */}
          {org.stripeCustomerId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              <CreditCard className="w-3 h-3" />
              Billing active
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
            >
              {isActive ? 'Active' : 'Select'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
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
      <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
      <p className="text-sm text-muted-foreground">
        Manage your organizations and switch between them
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="tabular-nums">
        {orgCount} {orgCount === 1 ? 'org' : 'orgs'}
      </Badge>
      <Button onClick={onCreateNew} size="sm">
        <Plus className="w-3.5 h-3.5" />
        New Organization
      </Button>
    </div>
  </div>
);

// Main Organizations Page
const OrganizationsPage: React.FC = () => {
  const { openLauncher } = useLauncher();
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

  // Register toolbar context: secondary "Add Organization" button + search
  useToolbarContext({
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
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
      <PageHeader orgCount={filteredOrganizations.length} onCreateNew={handleCreateNew} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
