import { useLiveQuery } from '@tanstack/react-db';

import { 
  Building2, 
  Plus, 
  Users, 
  Calendar, 
  Settings, 
  MoreVertical,
  Crown,
  Sparkles,
  Zap,
  Building
} from 'lucide-react';
import { getCollections } from '../../lib/tanstack-db';
import { useOrganizationStore } from '../../stores/store';
import type { Organization } from '@credopass/lib/schemas';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@credopass/ui';
import EmptyState from '../../components/empty-state';
import { useLauncher } from '../../stores/store';
import { launchOrganizationForm } from '../../containers/OrganizationForm';
import './style.css';

const { organizations: organizationCollection } = getCollections();

// Plan badge colors and icons
const planConfig = {
  free: { color: 'secondary', icon: Building, label: 'Free' },
  starter: { color: 'default', icon: Zap, label: 'Starter' },
  pro: { color: 'default', icon: Sparkles, label: 'Pro' },
  enterprise: { color: 'default', icon: Crown, label: 'Enterprise' },
} as const;

// Organization Card Component
const OrganizationCard = ({ 
  org, 
  isActive, 
  onSelect 
}: { 
  org: Organization; 
  isActive: boolean;
  onSelect: () => void;
}) => {
  const { openLauncher } = useLauncher();
  const plan = planConfig[org.plan as keyof typeof planConfig] || planConfig.free;
  const PlanIcon = plan.icon;

  return (
    <Card 
      className={`org-card ${isActive ? 'org-card--active' : ''}`}
      onClick={onSelect}
    >
      <CardHeader className="org-card__header">
        <div className="org-card__title-row">
          <div className="org-card__icon">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="org-card__title-content">
            <CardTitle className="org-card__name">{org.name}</CardTitle>
            <CardDescription className="org-card__slug">/{org.slug}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="org-card__menu-btn">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                launchOrganizationForm({ 
                  initialData: {
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    plan: org.plan,
                  },
                  isEditing: true 
                }, openLauncher);
              }}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="org-card__badges">
          <Badge variant={plan.color as any} className="org-card__plan-badge">
            <PlanIcon className="mr-1 h-3 w-3" />
            {plan.label}
          </Badge>
          {isActive && (
            <Badge variant="outline" className="org-card__active-badge">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="org-card__content">
        <div className="org-card__stats">
          <div className="org-card__stat">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">-- members</span>
          </div>
          <div className="org-card__stat">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">-- events</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Organizations Page
const OrganizationsPage = () => {
  const { openLauncher } = useLauncher();
  const { activeOrganizationId, setActiveOrganization } = useOrganizationStore();
  
  const orgsQuery = useLiveQuery((query) =>
    query
      .from({ organizations: organizationCollection })
      .select((refs) => refs.organizations)
  );

  const organizations = (orgsQuery.data ?? []) as Organization[];

  const handleSelectOrganization = (org: Organization) => {
    setActiveOrganization(org.id, org);
  };

  if (organizations.length === 0) {
    return (
      <div className="organizations-page">
        <EmptyState
          title="No organizations yet"
          description="Create your first organization to get started with attendance tracking."
          icon={<Building2 className="h-12 w-12" />}
          action={{
            label: "Create Organization",
            onClick: () => launchOrganizationForm({}, openLauncher)
          }}
        />
      </div>
    );
  }

  return (
    <div className="organizations-page">
      <div className="organizations-page__header">
        <div>
          <h1 className="organizations-page__title">Organizations</h1>
          <p className="organizations-page__subtitle">
            Manage your organizations and switch between them
          </p>
        </div>
        <Button onClick={() => launchOrganizationForm({}, openLauncher)}>
          <Plus className="mr-2 h-4 w-4" />
          New Organization
        </Button>
      </div>

      <div className="organizations-page__grid">
        {organizations.map((org) => (
          <OrganizationCard
            key={org.id}
            org={org}
            isActive={org.id === activeOrganizationId}
            onSelect={() => handleSelectOrganization(org)}
          />
        ))}
      </div>
    </div>
  );
};

export default OrganizationsPage;
