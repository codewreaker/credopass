import React, { useCallback, useState, useMemo } from "react";
import { useLiveQuery } from '@tanstack/react-db'
import { type UserType, User } from '@credopass/lib/schemas'
import { getCollections } from '@credopass/api-client/collections';

import { 
  UserPlus, 
  Search, 
  Mail, 
  Calendar, 
  Star, 
  Trophy, 
  ChevronRight, 
  Filter,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
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
import { Checkbox } from '@credopass/ui/components/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@credopass/ui/components/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@credopass/ui/components/dropdown-menu';
import { cn } from '@credopass/ui/lib/utils';

// Tier configuration with colors
const TIER_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: typeof Star; label: string }> = {
  bronze: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', icon: Star, label: 'Bronze' },
  silver: { color: 'text-slate-400', bgColor: 'bg-slate-400/10', borderColor: 'border-slate-400/30', icon: Star, label: 'Silver' },
  gold: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: Trophy, label: 'Gold' },
  platinum: { color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', borderColor: 'border-cyan-400/30', icon: Trophy, label: 'Platinum' },
};

// Event attendance badge styles
const EVENT_STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle }> = {
  attended: { color: 'text-green-500', bgColor: 'bg-green-500/10', icon: CheckCircle },
  missed: { color: 'text-red-500', bgColor: 'bg-red-500/10', icon: XCircle },
  upcoming: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Clock },
};

// Mock event data for demo
const MOCK_EVENTS = [
  { id: '1', name: 'Tech Summit 2024', status: 'attended' },
  { id: '2', name: 'Hackathon', status: 'attended' },
  { id: '3', name: 'Workshop', status: 'missed' },
  { id: '4', name: 'Meetup', status: 'upcoming' },
];

// Event Badge Component
const EventBadge: React.FC<{ name: string; status: string }> = ({ name, status }) => {
  const config = EVENT_STATUS_CONFIG[status] || EVENT_STATUS_CONFIG.upcoming;
  const StatusIcon = config.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
            config.bgColor,
            config.color,
            "border-current/20"
          )}>
            <StatusIcon size={10} />
            <span className="truncate max-w-[60px]">{name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{name} - {status.charAt(0).toUpperCase() + status.slice(1)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Table Header Cell
const TableHeaderCell: React.FC<{ 
  children: React.ReactNode; 
  sortable?: boolean;
  className?: string;
}> = ({ children, sortable, className }) => (
  <div className={cn(
    "flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider font-semibold",
    sortable && "cursor-pointer hover:text-foreground transition-colors group",
    className
  )}>
    {children}
    {sortable && (
      <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    )}
  </div>
);

// Member Table Row Component
interface MemberTableRowProps {
  member: UserType;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: (member: UserType) => void;
  onDelete: (member: UserType) => void;
  onView: (member: UserType) => void;
}

const MemberTableRow: React.FC<MemberTableRowProps> = ({ 
  member, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete,
  onView
}) => {
  const tier = (member as any).tier || 'bronze';
  const points = (member as any).points || 0;
  const totalEvents = (member as any).totalEvents || 0;
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;

  const initials = `${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown User';
  
  // Mock events for this member (in real app, this would come from member data)
  const memberEvents = MOCK_EVENTS.slice(0, Math.min(totalEvents || 2, 3));

  return (
    <tr className={cn(
      "group border-b border-border/50 hover:bg-muted/30 transition-colors",
      isSelected && "bg-primary/5"
    )}>
      {/* Checkbox */}
      <td className="w-12 px-4 py-3">
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={onSelect}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </td>

      {/* Member Info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar size="md" className={cn(
              "ring-2 ring-offset-1 ring-offset-background",
              tierConfig.color.replace('text-', 'ring-')
            )}>
              <AvatarImage src={(member as any).avatarUrl} alt={fullName} />
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full",
              tierConfig.bgColor
            )}>
              <TierIcon size={8} className={tierConfig.color} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Mail size={10} />
              {member.email || 'No email'}
            </p>
          </div>
        </div>
      </td>

      {/* Tier */}
      <td className="px-4 py-3">
        <Badge 
          variant="outline" 
          className={cn(
            "text-[10px] capitalize",
            tierConfig.bgColor,
            tierConfig.color,
            tierConfig.borderColor
          )}
        >
          <TierIcon size={10} className="mr-1" />
          {tierConfig.label}
        </Badge>
      </td>

      {/* Points */}
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Star size={12} className="text-primary" />
          <span className="text-sm font-semibold">{points.toLocaleString()}</span>
        </div>
      </td>

      {/* Events with Badges */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {memberEvents.length > 0 ? (
            <>
              {memberEvents.slice(0, 2).map((event) => (
                <EventBadge key={event.id} name={event.name} status={event.status} />
              ))}
              {memberEvents.length > 2 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{memberEvents.length - 2}
                </Badge>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No events</span>
          )}
        </div>
      </td>

      {/* Total Events */}
      <td className="px-4 py-3 text-center hidden lg:table-cell">
        <div className="flex items-center justify-center gap-1">
          <Calendar size={12} className="text-muted-foreground" />
          <span className="text-sm font-medium">{totalEvents}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-12">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
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
            <DropdownMenuItem 
              onClick={() => onDelete(member)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 size={14} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  const isError = userCollection.utils.isError;
  const rowData: UserType[] = Array.isArray(data) ? data : [];
  const { openLauncher } = useLauncher();

  const handleCreateUser = useCallback(() => {
    launchUserForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  const handleEditUser = useCallback((user: UserType) => {
    launchUserForm({ isEditing: true, initialData: user }, openLauncher);
  }, [openLauncher]);

  const handleViewUser = useCallback((user: UserType) => {
    // TODO: Implement view user profile
    console.log('View user:', user);
  }, []);

  useToolbarContext({
    action: { icon: UserPlus, label: 'Add Person', onClick: handleCreateUser },
    search: { enabled: true, placeholder: 'Search members...', onSearch: setSearchQuery },
  });

  const deleteUser = useCallback((user: User) => {
    userCollection.delete(user.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(user.id);
      return next;
    });
  }, [userCollection]);

  // Filter members by search query and tier
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
      result = result.filter(m => (m as any).tier === tierFilter);
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

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMembers.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filteredMembers]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const allSelected = filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

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
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <Button
            variant={tierFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setTierFilter(null)}
            className="h-7 text-xs"
          >
            All
          </Button>
          {Object.entries(TIER_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              variant={tierFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setTierFilter(tierFilter === key ? null : key)}
              className={cn(
                "h-7 text-xs gap-1",
                tierFilter !== key && config.color
              )}
            >
              <config.icon size={10} />
              {config.label}
            </Button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => {
                selectedIds.forEach(id => {
                  const user = rowData.find(m => m.id === id);
                  if (user) userCollection.delete(user.id);
                });
                setSelectedIds(new Set());
              }}
            >
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Member Table */}
      <div className="flex-1 overflow-auto">
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
          <table className="w-full">
            <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <Checkbox 
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className={cn(
                      "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                      someSelected && "data-[state=indeterminate]:bg-primary/50"
                    )}
                    {...(someSelected ? { "data-state": "indeterminate" } : {})}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeaderCell sortable>Member</TableHeaderCell>
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeaderCell sortable>Tier</TableHeaderCell>
                </th>
                <th className="px-4 py-3 text-center">
                  <TableHeaderCell sortable className="justify-center">Points</TableHeaderCell>
                </th>
                <th className="px-4 py-3 text-left">
                  <TableHeaderCell>Events</TableHeaderCell>
                </th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">
                  <TableHeaderCell sortable className="justify-center">Total</TableHeaderCell>
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <MemberTableRow
                  key={member.id}
                  member={member}
                  isSelected={selectedIds.has(member.id)}
                  onSelect={(checked) => handleSelectOne(member.id, checked)}
                  onEdit={handleEditUser}
                  onDelete={deleteUser}
                  onView={handleViewUser}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
