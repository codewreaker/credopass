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
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@credopass/ui';
import EmptyState from '../../components/empty-state';
import { launchOrganizationForm } from '../../containers/OrganizationForm';
import './style.css';

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
}

const OrganizationCard: React.FC<OrgCardProps> = ({ org, isActive, onSelect, onEdit, eventCount }) => {
  const plan = planConfig[org.plan] || planConfig.free;
  const PlanIcon = plan.icon;

  return (
    <Card
      className={`org-card cursor-pointer hover:shadow-lg transition-all duration-200 group ${isActive ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
        }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`org-icon-wrapper ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <Building2 className="w-5 h-5" />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-item">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{org.members ?? '--'} members</span>
            </div>
            <div className="stat-item">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{eventCount ?? '--'} events</span>
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
  <div className="org-page-header">
    <div className="flex items-center gap-3">
      <div className="header-icon-wrapper">
        <Building2 className="w-6 h-6" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-muted-foreground">
          Manage your organizations and switch between them
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="text-sm">
        {orgCount} {orgCount === 1 ? 'organization' : 'organizations'}
      </Badge>
      <Button onClick={onCreateNew}>
        <Plus className="w-4 h-4 mr-2" />
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
    events: eventCollection
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

  // Empty state
  if (organizations.length === 0) {
    return (
      <div className="organizations-page">
        <EmptyState
          title="No organizations yet"
          description="Create your first organization to get started with attendance tracking."
          icon={<Building2 className="h-12 w-12" />}
          action={{
            label: "Create Organization",
            onClick: handleCreateNew
          }}
        />
      </div>
    );
  }
  

  return (
    <div className="organizations-page">
      <PageHeader orgCount={filteredOrganizations.length} onCreateNew={handleCreateNew} />

      <div className="org-grid">
        {filteredOrganizations.map((org: Organization) => (
          <OrganizationCard
            key={org.id}
            org={org}
            eventCount={eventCount?.find(ec => ec.organizationId === org.id)?.eventCount || 0}
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
