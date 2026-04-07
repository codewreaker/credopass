import React, { useCallback, useState, useMemo } from "react";
import { useLiveQuery } from '@tanstack/react-db'
import { type UserType, User } from '@credopass/lib/schemas'
import { getCollections } from '@credopass/api-client/collections';

import { UserPlus, Search, MoreVertical, Mail, Calendar, Star, Trophy, ChevronRight } from "lucide-react";
import { useLauncher } from '@credopass/lib/stores';
import { launchUserForm } from '../../containers/UserForm/index';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Loader } from '@credopass/ui/components/loader';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@credopass/ui/components/avatar';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Input } from '@credopass/ui/components/input';
import { Card } from '@credopass/ui/components/card';
import { Separator } from '@credopass/ui/components/separator';
import { cn } from '@credopass/ui/lib/utils';

// Tier configuration with colors
const TIER_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof Star }> = {
  bronze: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Star },
  silver: { color: 'text-slate-400', bgColor: 'bg-slate-400/10', icon: Star },
  gold: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: Trophy },
  platinum: { color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', icon: Trophy },
};

// Member Row Component
interface MemberRowProps {
  member: UserType;
  onEdit: (member: UserType) => void;
  onDelete: (member: UserType) => void;
}

const MemberRow: React.FC<MemberRowProps> = ({ member, onEdit }) => {
  const tier = (member as any).tier || 'bronze';
  const points = (member as any).points || 0;
  const totalEvents = (member as any).totalEvents || 0;
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;

  const initials = `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown User';

  return (
    <button
      type="button"
      onClick={() => onEdit(member)}
      className="group w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-all duration-200 rounded-xl"
    >
      {/* Avatar with tier ring */}
      <div className="relative">
        <Avatar size="lg" className={cn("ring-2 ring-offset-2 ring-offset-background", tierConfig.color.replace('text-', 'ring-'))}>
          <AvatarImage src={(member as any).avatarUrl} alt={fullName} />
          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        {/* Tier badge */}
        <div className={cn("absolute -bottom-1 -right-1 p-1 rounded-full", tierConfig.bgColor)}>
          <TierIcon size={10} className={tierConfig.color} />
        </div>
      </div>

      {/* Member Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-semibold text-foreground truncate">{fullName}</h3>
          <Badge variant="outline" className={cn("text-[10px] capitalize h-5", tierConfig.bgColor, tierConfig.color)}>
            {tier}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <Mail size={10} />
          {member.email || 'No email'}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-6 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{points.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Points</p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-lg font-bold text-foreground">{totalEvents}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Events</p>
        </div>
      </div>

      {/* Action */}
      <ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
    </button>
  );
};

// Stats Card Component
const StatsCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; trend?: string }> = ({ 
  label, value, icon, trend 
}) => (
  <Card className="p-4 flex items-center gap-4">
    <div className="p-2.5 rounded-xl bg-primary/10">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
    {trend && (
      <Badge variant="secondary" className="text-xs">
        {trend}
      </Badge>
    )}
  </Card>
);

export default function MembersPage() {
  const { users: userCollection } = getCollections();
  const { data, isLoading } = useLiveQuery((q) => q.from({ userCollection }));
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Use collection's error tracking utilities
  const isError = userCollection.utils.isError;

  const rowData: UserType[] = Array.isArray(data) ? data : []
  const { openLauncher } = useLauncher();

  const handleCreateUser = useCallback(() => {
    launchUserForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  const handleEditUser = useCallback((user: UserType) => {
    launchUserForm({ isEditing: true, initialData: user }, openLauncher);
  }, [openLauncher]);

  // Register toolbar context: secondary "Add Person" button + search
  useToolbarContext({
    action: { icon: UserPlus, label: 'Add Person', onClick: handleCreateUser },
    search: { enabled: true, placeholder: 'Search members...', onSearch: setSearchQuery },
  });

  const deleteUser = useCallback((user: User) => {
    userCollection.delete(user.id);
  }, [userCollection]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return rowData;
    const q = searchQuery.toLowerCase();
    return rowData.filter(
      (m) =>
        m.firstName?.toLowerCase().includes(q) ||
        m.lastName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    );
  }, [rowData, searchQuery]);

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

  if (isLoading) return <Loader />

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">Manage your community members and their engagement</p>
          </div>
          <Button onClick={handleCreateUser} className="gap-2">
            <UserPlus size={16} />
            Add Member
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard 
            label="Total Members" 
            value={stats.totalMembers} 
            icon={<UserPlus size={18} className="text-primary" />}
          />
          <StatsCard 
            label="Total Points" 
            value={stats.totalPoints.toLocaleString()} 
            icon={<Star size={18} className="text-primary" />}
          />
          <StatsCard 
            label="Active Members" 
            value={stats.activeMembers} 
            icon={<Calendar size={18} className="text-primary" />}
            trend={`${Math.round((stats.activeMembers / (stats.totalMembers || 1)) * 100)}%`}
          />
          <StatsCard 
            label="Avg Events/Member" 
            value={stats.avgAttendance} 
            icon={<Trophy size={18} className="text-primary" />}
          />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted">All</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted text-yellow-500">Gold</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted text-slate-400">Silver</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted text-amber-600">Bronze</Badge>
        </div>
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredMembers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title={searchQuery ? "No members found" : "No members yet"}
              description={searchQuery 
                ? "Try adjusting your search terms" 
                : "Add your first member to start building your community."
              }
              action={!searchQuery ? { label: "Add Member", onClick: handleCreateUser } : undefined}
            />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">
              <div className="w-12" /> {/* Avatar space */}
              <div className="flex-1">Member</div>
              <div className="w-20 text-center">Points</div>
              <div className="w-16" /> {/* Separator space */}
              <div className="w-20 text-center">Events</div>
              <div className="w-8" /> {/* Action space */}
            </div>
            <Separator className="bg-gradient-to-r from-transparent via-muted to-transparent" />
            
            {/* Member Rows */}
            {filteredMembers.map((member, idx) => (
              <React.Fragment key={member.id}>
                <MemberRow 
                  member={member} 
                  onEdit={handleEditUser}
                  onDelete={deleteUser}
                />
                {idx < filteredMembers.length - 1 && (
                  <Separator className="bg-gradient-to-r from-transparent via-muted/50 to-transparent ml-16" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
