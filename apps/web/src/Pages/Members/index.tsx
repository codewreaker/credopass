import React, { useCallback, useState, useMemo } from "react";
import { useLiveQuery } from '@tanstack/react-db'
import { type UserType, User } from '@credopass/lib/schemas'
import { getCollections } from '@credopass/api-client/collections';

import {
  UserPlus,
  Star,
  Trophy,
  Calendar,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  ChevronRight,
  LayoutGrid
} from "lucide-react";
import { useLauncher, useAppStore } from '@credopass/lib/stores';
import { launchUserForm } from '../../containers/UserForm/index';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@credopass/ui/components/avatar';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Card } from '@credopass/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@credopass/ui/components/dropdown-menu';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from "@credopass/ui/hooks/use-mobile";
import { UpgradeCTA } from '@credopass/ui/components/upgrade-cta';
import { useNavigate } from '@tanstack/react-router';

// Tier configuration with colors
const TIER_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: typeof Star; label: string }> = {
  bronze: { color: 'text-tier-bronze', bgColor: 'bg-tier-bronze/10', borderColor: 'border-tier-bronze/30', icon: Star, label: 'Bronze' },
  silver: { color: 'text-tier-silver', bgColor: 'bg-tier-silver/10', borderColor: 'border-tier-silver/30', icon: Star, label: 'Silver' },
  gold: { color: 'text-tier-gold', bgColor: 'bg-tier-gold/10', borderColor: 'border-tier-gold/30', icon: Trophy, label: 'Gold' },
  platinum: { color: 'text-tier-platinum', bgColor: 'bg-tier-platinum/10', borderColor: 'border-tier-platinum/30', icon: Trophy, label: 'Platinum' },
};

const TIER_KEYS = Object.keys(TIER_CONFIG);

// Member card — one design across phone, tablet and desktop
interface MemberCardProps {
  member: UserType;
  onEdit: (member: UserType) => void;
  onDelete: (member: UserType) => void;
  onView: (member: UserType) => void;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, onEdit, onDelete, onView }) => {
  const tier = (member as any).tier || 'bronze';
  const points = (member as any).points || 0;
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;
  const initials = `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown User';
  const joined = (member as any).createdAt
    ? new Date((member as any).createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <Card
      onClick={() => onView(member)}
      className="group relative rounded-none border-0 p-4 cursor-pointer transition-all duration-200 hover:bg-muted/40 hover:shadow-elevation-1 active:scale-[0.995]"
    >
      <div className="flex items-center gap-3">
        <Avatar size="default" className="shrink-0">
          <AvatarImage src={(member as any).avatarUrl} alt={fullName} />
          <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email || 'No email'}</p>
        </div>

        {/* Inline meta — tablet and up */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {joined && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 tabular-nums">
              <Calendar size={10} />
              {joined}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground tabular-nums">
            <Star size={10} className="text-primary" />
            {points.toLocaleString()} pts
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', tierConfig.bgColor, tierConfig.color)}>
            <TierIcon size={9} />
            {tierConfig.label}
          </span>
          <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </div>

        <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon-xs" className="text-muted-foreground/50 hover:text-foreground">
                <MoreHorizontal size={14} />
              </Button>
            )} />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onView(member)} className="gap-2">
                <Eye size={14} />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(member)} className="gap-2">
                <Edit size={14} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(member)} className="gap-2 text-destructive focus:text-destructive">
                <Trash2 size={14} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile meta row */}
      <div className="sm:hidden flex items-center gap-2 mt-3.5 pt-3 border-t border-border/60">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', tierConfig.bgColor, tierConfig.color)}>
          <TierIcon size={9} />
          {tierConfig.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground tabular-nums">
          <Star size={10} className="text-primary" />
          {points.toLocaleString()} pts
        </span>
        {joined && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 tabular-nums">
            <Calendar size={10} />
            {joined}
          </span>
        )}
        <ChevronRight size={13} className="text-muted-foreground/30 shrink-0" />
      </div>
    </Card>
  );
};

// Stats Card Component
const StatsCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode; trend?: string
  className?: string
}> = ({
  label, value, icon, trend, className
}) => (
    <Card className={cn("p-2.5 md:p-4 flex flex-row items-center gap-2.5 md:gap-4", className)}>
      <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-primary/10 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base md:text-2xl font-bold tracking-tight text-foreground truncate tabular-nums leading-tight">{value}</p>
        <p className="text-[11px] md:text-xs text-muted-foreground truncate">{label}</p>
      </div>
      {trend && (
        <Badge variant="secondary" className="text-xs hidden md:inline-flex">
          {trend}
        </Badge>
      )}
    </Card>
  );

export default function MembersPage() {
  const { users: userCollection } = getCollections();
  const { data, isLoading } = useLiveQuery((q) => q.from({ userCollection }));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  const isError = userCollection.utils.isError;
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const rowData: UserType[] = Array.isArray(data) ? data : [];
  const { openLauncher, closeLauncher } = useLauncher();

  const handleCreateUser = useCallback(() => {
    launchUserForm({ isEditing: false }, openLauncher, closeLauncher);
  }, [openLauncher, closeLauncher]);

  const handleEditUser = useCallback((user: UserType) => {
    launchUserForm({ isEditing: true, initialData: { ...user, phone: user.phone ?? '' } }, openLauncher, closeLauncher);
  }, [openLauncher, closeLauncher]);

  const setViewedItem = useAppStore((st) => st.setViewedItem);
  const toggleSidebar = useAppStore((st) => st.toggleSidebar);

  const handleViewUser = useCallback((user: UserType) => {
    setViewedItem({ id: 'profile', content: user });
    toggleSidebar('right', true);
  }, [setViewedItem, toggleSidebar]);

  // Toolbar owns search — no in-page search bar needed
  useToolbarContext({
    action: { icon: UserPlus, label: 'Add Person', onClick: handleCreateUser },
    search: { enabled: true, placeholder: 'Search members...', onSearch: setSearchQuery },
  });

  const deleteUser = useCallback((user: User) => {
    userCollection.delete(user.id);
  }, [userCollection]);

  // Filter members by toolbar search query and tier
  const filteredMembers = useMemo(() => {
    let result = rowData;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.firstName?.toLowerCase().includes(q) ||
          m.lastName?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      );
    }

    if (tierFilter) {
      result = result.filter(m => (((m as any).tier || 'bronze') === tierFilter));
    }

    return result;
  }, [rowData, searchQuery, tierFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalMembers = rowData.length;
    const totalPoints = rowData.reduce((sum, m) => sum + ((m as any).points || 0), 0);
    const activeMembers = rowData.filter(m => (m as any).totalEvents > 0).length;
    const avgAttendance = totalMembers > 0
      ? Math.round(rowData.reduce((sum, m) => sum + ((m as any).totalEvents || 0), 0) / totalMembers)
      : 0;
    return { totalMembers, totalPoints, activeMembers, avgAttendance };
  }, [rowData]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-4" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-44" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-6 lg:grid-cols-4 gap-2 md:gap-4">
          <Skeleton className="col-span-6 lg:col-span-1 h-16 md:h-20 rounded-xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="col-span-2 lg:col-span-1 h-14 md:h-20 rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <EmptyState
          error
          title="Error Loading Members"
          description={`An error occurred while fetching members: ${userCollection.utils.lastError}`}
          action={{ label: "Retry", onClick: userCollection.utils.refetch }}
        />
      </div>
    );
  }

  const iconSize = isMobile ? 12 : 18;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed header + stats */}
      <div className="pb-2 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">
              {stats.totalMembers} member{stats.totalMembers === 1 ? '' : 's'} in your community
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UpgradeCTA size="md" className="hidden lg:inline-flex" onClick={() => navigate({ to: '/upgrade' })} />
            <Button onClick={handleCreateUser} className="gap-2 rounded-full font-semibold">
              <UserPlus size={16} />
              Add Member
            </Button>
          </div>
        </div>

        {/* Stats Row: lime feature stat + tiles */}
        <div className="grid grid-cols-6 lg:grid-cols-4 gap-2 md:gap-4 py-1">
          <Card className="col-span-6 lg:col-span-1 relative overflow-hidden border-0 bg-primary text-primary-foreground p-3.5 md:p-4 flex flex-row items-center gap-3 md:gap-4">
            <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full border-[10px] border-primary-foreground/8" />
            <div className="p-2.5 rounded-xl bg-primary-foreground text-primary relative z-10">
              <UserPlus size={iconSize} />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-2xl md:text-3xl font-bold tracking-tight truncate tabular-nums">{stats.totalMembers}</p>
              <p className="text-[11px] md:text-xs font-medium text-primary-foreground/65 truncate">Total members</p>
            </div>
          </Card>
          <StatsCard
            className="col-span-2 lg:col-span-1"
            label="Points"
            value={stats.totalPoints.toLocaleString()}
            icon={<Star size={iconSize} className="text-primary" />}
          />
          <StatsCard
            className="col-span-2 lg:col-span-1"
            label="Active"
            value={stats.activeMembers}
            icon={<Calendar size={iconSize} className="text-primary" />}
            trend={`${Math.round((stats.activeMembers / (stats.totalMembers || 1)) * 100)}%`}
          />
          <StatsCard
            className="col-span-2 lg:col-span-1"
            label="Avg events"
            value={stats.avgAttendance}
            icon={<Trophy size={iconSize} className="text-primary" />}
          />
        </div>
      </div>

      {/* Fixed tier filter — compact segmented control */}
      <div className="flex items-center justify-between gap-3 py-3 shrink-0 border-b border-border/60">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTierFilter(null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150',
              tierFilter === null ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid size={11} />
            All
          </button>
          {TIER_KEYS.map((key) => {
            const config = TIER_CONFIG[key];
            const active = tierFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTierFilter(active ? null : key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150',
                  active ? 'bg-primary text-primary-foreground' : cn('hover:bg-muted/60', config.color)
                )}
              >
                <config.icon size={11} />
                {config.label}
              </button>
            );
          })}
        </div>
        <span className="hidden sm:block text-xs text-muted-foreground tabular-nums shrink-0">
          {filteredMembers.length} shown
        </span>
      </div>

      {/* Scrollable member list */}
      <div className="flex-1 overflow-auto min-h-0 pt-3 pb-4">
        {filteredMembers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title={searchQuery || tierFilter ? "No members found" : "No members yet"}
              description={searchQuery || tierFilter
                ? "Try adjusting your search or filters"
                : "Add your first member to start building your community."
              }
              action={!searchQuery && !tierFilter ? { label: "Add Member", onClick: handleCreateUser } : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={handleEditUser}
                onDelete={deleteUser}
                onView={handleViewUser}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
