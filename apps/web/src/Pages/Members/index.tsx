import React, { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useNavigate } from '@tanstack/react-router';
import { getCollections } from '@credopass/api-client/collections';
import type { AttendanceType, EventMember, EventType, UserType } from '@credopass/lib/schemas';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Edit,
  Eye,
  LayoutGrid,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@credopass/lib/stores';
import { EmptyState } from '@credopass/ui/components/empty-state';
import { Skeleton } from '@credopass/ui/components/skeleton';
import { useToolbarContext } from '@credopass/lib/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@credopass/ui/components/avatar';
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

/**
 * The members section answers two questions: who has turned up to our past
 * events, and who is signed up for an upcoming one. The scope switcher is
 * therefore a list of events (plus "All"), not a list of people attributes —
 * a member only means anything relative to an event.
 */

/** How a person relates to the event currently in scope. */
type Standing = 'attended' | 'no-show' | 'signed-up' | 'member';

const STANDING_CONFIG: Record<Standing, { label: string; className: string; icon: typeof Users }> = {
  attended: {
    label: 'Attended',
    className: 'bg-success/10 text-success',
    icon: CheckCircle2,
  },
  'no-show': {
    label: 'No-show',
    className: 'bg-destructive/10 text-destructive',
    icon: XCircle,
  },
  'signed-up': {
    label: 'Signed up',
    className: 'bg-primary/10 text-primary',
    icon: CalendarClock,
  },
  member: {
    label: 'Member',
    className: 'bg-muted text-muted-foreground',
    icon: Users,
  },
};

interface MemberRow {
  user: UserType;
  standing: Standing;
  /** How many of your events this person has actually attended. */
  eventsAttended: number;
  /** Set when the row is scoped to one event. */
  checkInTime?: Date | null;
  role?: string;
}

const MemberCard: React.FC<{
  row: MemberRow;
  onEdit: (user: UserType) => void;
  onDelete: (user: UserType) => void;
  onView: (user: UserType) => void;
}> = ({ row, onEdit, onDelete, onView }) => {
  const { user, standing, eventsAttended, checkInTime, role } = row;
  const initials =
    `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
  const config = STANDING_CONFIG[standing];
  const StandingIcon = config.icon;

  return (
    <Card
      onClick={() => onView(user)}
      className="group relative cursor-pointer rounded-none border-0 p-4 transition-all duration-200 hover:bg-muted/40 hover:shadow-elevation-1 active:scale-[0.995]"
    >
      <div className="flex items-center gap-3">
        <Avatar size="default" className="shrink-0">
          <AvatarImage src={(user as { avatarUrl?: string }).avatarUrl} alt={fullName} />
          <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{fullName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email || 'No email'}</p>
        </div>

        {/* Inline meta — tablet and up */}
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {checkInTime && (
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/70">
              <Calendar size={10} />
              {new Date(checkInTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          {role && (
            <span className="text-[11px] font-medium capitalize text-muted-foreground">{role}</span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            <Users size={10} className="text-primary" />
            {eventsAttended} attended
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              config.className
            )}
          >
            <StandingIcon size={9} />
            {config.label}
          </span>
          <ChevronRight
            size={13}
            className="text-muted-foreground/30 transition-colors group-hover:text-primary"
          />
        </div>

        <div onClick={(e) => e.stopPropagation()} className="-mr-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground/50 hover:text-foreground"
                >
                  <MoreHorizontal size={14} />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onView(user)} className="gap-2">
                <Eye size={14} />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(user)} className="gap-2">
                <Edit size={14} />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(user)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 size={14} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile meta row */}
      <div className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-3 sm:hidden">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            config.className
          )}
        >
          <StandingIcon size={9} />
          {config.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
          <Users size={10} className="text-primary" />
          {eventsAttended} attended
        </span>
        {role && (
          <span className="ml-auto text-[11px] font-medium capitalize text-muted-foreground">
            {role}
          </span>
        )}
        <ChevronRight size={13} className="shrink-0 text-muted-foreground/30" />
      </div>
    </Card>
  );
};

const asArray = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

export default function MembersPage() {
  const {
    users: userCollection,
    events: eventCollection,
    attendance: attendanceCollection,
    eventMembers: eventMemberCollection,
  } = getCollections();

  const { data: usersData, isLoading } = useLiveQuery((q) => q.from({ userCollection }));
  const { data: eventsData } = useLiveQuery((q) => q.from({ eventCollection }));
  const { data: attendanceData } = useLiveQuery((q) => q.from({ attendanceCollection }));
  const { data: eventMembersData } = useLiveQuery((q) => q.from({ eventMemberCollection }));

  const [searchQuery, setSearchQuery] = useState<string>('');
  /** 'all' or an event id. */
  const [scope, setScope] = useState<string>('all');

  const isError = userCollection.utils.isError;
  const navigate = useNavigate();

  const users = useMemo(() => asArray<UserType>(usersData), [usersData]);
  const events = useMemo(() => asArray<EventType>(eventsData), [eventsData]);
  const attendance = useMemo(() => asArray<AttendanceType>(attendanceData), [attendanceData]);
  const eventMembers = useMemo(() => asArray<EventMember>(eventMembersData), [eventMembersData]);

  const handleCreateUser = useCallback(() => {
    // Members are added onto an event; without a scope the composer asks for one.
    navigate({
      to: '/members/new',
      search: scope === 'all' ? {} : { eventId: scope },
    });
  }, [navigate, scope]);

  const handleEditUser = useCallback(
    (user: UserType) => {
      navigate({
        to: '/members/$userId/edit',
        params: { userId: user.id },
        search: scope === 'all' ? {} : { eventId: scope },
      });
    },
    [navigate, scope]
  );

  const setViewedItem = useAppStore((st) => st.setViewedItem);
  const toggleSidebar = useAppStore((st) => st.toggleSidebar);

  const handleViewUser = useCallback(
    (user: UserType) => {
      setViewedItem({ id: 'profile', content: user });
      toggleSidebar('right', true);
    },
    [setViewedItem, toggleSidebar]
  );

  // Toolbar owns search — no in-page search bar needed
  useToolbarContext({
    action: { icon: UserPlus, label: 'Add Person', onClick: handleCreateUser },
    search: { enabled: true, placeholder: 'Search members...', onSearch: setSearchQuery },
  });

  const deleteUser = useCallback(
    (user: UserType) => {
      userCollection.delete(user.id);
    },
    [userCollection]
  );

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  /** Attendance totals across every event, used as the trailing meta on each row. */
  const attendedCountByUser = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of attendance) {
      if (!record.attended) continue;
      counts.set(record.patronId, (counts.get(record.patronId) ?? 0) + 1);
    }
    return counts;
  }, [attendance]);

  /** Events split into the two things you might want to look at. */
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = Date.now();
    const upcoming: EventType[] = [];
    const past: EventType[] = [];
    for (const event of events) {
      const start = event.startTime ? new Date(event.startTime).getTime() : 0;
      if (event.status === 'ongoing' || (event.status === 'scheduled' && start >= now)) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    }
    const bySoonest = (a: EventType, b: EventType) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    return {
      upcomingEvents: upcoming.sort(bySoonest),
      pastEvents: past.sort((a, b) => bySoonest(b, a)),
    };
  }, [events]);

  const scopedEvent = useMemo(
    () => events.find((e) => e.id === scope) ?? null,
    [events, scope]
  );
  const isPastScope = useMemo(
    () => (scopedEvent ? pastEvents.some((e) => e.id === scopedEvent.id) : false),
    [pastEvents, scopedEvent]
  );

  /**
   * Rows for the current scope. "All" is everyone who has ever attended any of
   * your programmes; a specific event joins users against its sign-ups and, for
   * an event that has already run, its attendance records.
   */
  const rows = useMemo<MemberRow[]>(() => {
    const withCounts = (user: UserType, standing: Standing, extra: Partial<MemberRow> = {}) => ({
      user,
      standing,
      eventsAttended: attendedCountByUser.get(user.id) ?? 0,
      ...extra,
    });

    if (scope === 'all') {
      // Everyone who has ever turned up, plus anyone signed up to something.
      const seen = new Set<string>();
      const result: MemberRow[] = [];

      for (const [userId] of attendedCountByUser) {
        const user = usersById.get(userId);
        if (!user || seen.has(userId)) continue;
        seen.add(userId);
        result.push(withCounts(user, 'attended'));
      }

      for (const membership of eventMembers) {
        if (seen.has(membership.userId)) continue;
        const user = usersById.get(membership.userId);
        if (!user) continue;
        seen.add(membership.userId);
        result.push(withCounts(user, 'signed-up', { role: membership.role }));
      }

      // Anyone else on the books, so the page never hides people entirely.
      for (const user of users) {
        if (seen.has(user.id)) continue;
        seen.add(user.id);
        result.push(withCounts(user, 'member'));
      }

      return result;
    }

    const signUps = eventMembers.filter((m) => m.eventId === scope);
    const attendanceForEvent = new Map(
      attendance.filter((a) => a.eventId === scope).map((a) => [a.patronId, a])
    );

    const result: MemberRow[] = [];
    const seen = new Set<string>();

    for (const membership of signUps) {
      const user = usersById.get(membership.userId);
      if (!user) continue;
      seen.add(user.id);
      const record = attendanceForEvent.get(user.id);
      // A past event distinguishes turned-up from didn't; an upcoming one can't yet.
      const standing: Standing = record?.attended
        ? 'attended'
        : isPastScope
          ? 'no-show'
          : 'signed-up';
      result.push(
        withCounts(user, standing, { role: membership.role, checkInTime: record?.checkInTime })
      );
    }

    // Walk-ins: checked in without ever being signed up.
    for (const [patronId, record] of attendanceForEvent) {
      if (seen.has(patronId)) continue;
      const user = usersById.get(patronId);
      if (!user) continue;
      result.push(
        withCounts(user, record.attended ? 'attended' : 'no-show', {
          checkInTime: record.checkInTime,
        })
      );
    }

    return result;
  }, [attendance, attendedCountByUser, eventMembers, isPastScope, scope, users, usersById]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      ({ user }) =>
        user.firstName?.toLowerCase().includes(q) ||
        user.lastName?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const summary = useMemo(() => {
    const attended = filteredRows.filter((r) => r.standing === 'attended').length;
    const signedUp = filteredRows.filter((r) => r.standing === 'signed-up').length;
    const noShows = filteredRows.filter((r) => r.standing === 'no-show').length;
    return { attended, signedUp, noShows, total: filteredRows.length };
  }, [filteredRows]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-44" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-full" />
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          error
          title="Error Loading Members"
          description={`An error occurred while fetching members: ${userCollection.utils.lastError}`}
          action={{ label: 'Retry', onClick: userCollection.utils.refetch }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header + lime billboard summary */}
      <div className="shrink-0 pb-2">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Members</h1>
            <p className="truncate text-sm text-muted-foreground">
              {scopedEvent
                ? `${isPastScope ? 'Who attended' : 'Who is signed up for'} “${scopedEvent.name}”`
                : 'Everyone who has been to one of your programmes'}
            </p>
          </div>
          <Button onClick={handleCreateUser} className="gap-2 rounded-full font-semibold">
            <UserPlus size={16} />
            Add Member
          </Button>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-12 border-primary-foreground/8" />
          <div className="relative z-10 flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
                {summary.total}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                {scopedEvent ? 'On this event' : 'People'}
              </p>
            </div>
            <div className="flex items-stretch gap-6 border-l border-primary-foreground/15 pl-6">
              {(scopedEvent && isPastScope
                ? [
                    { label: 'Attended', value: summary.attended },
                    { label: 'No-shows', value: summary.noShows },
                  ]
                : [
                    { label: 'Signed up', value: summary.signedUp },
                    { label: 'Attended', value: summary.attended },
                  ]
              ).map(({ label, value }) => (
                <div key={label} className="flex flex-col justify-center">
                  <span className="text-xl font-semibold tabular-nums leading-none">{value}</span>
                  <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scope switcher — All, then one chip per event */}
      <div className="shrink-0 border-b border-border/60 py-3">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={cn(
              'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] font-semibold transition-colors duration-150',
              scope === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid size={11} />
            All
          </button>

          {upcomingEvents.length > 0 && (
            <span className="shrink-0 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Upcoming
            </span>
          )}
          {upcomingEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setScope(event.id)}
              className={cn(
                'inline-flex h-7 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 truncate whitespace-nowrap rounded-full px-3 text-[11px] font-semibold transition-colors duration-150',
                scope === event.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarClock size={11} />
              {event.name}
            </button>
          ))}

          {pastEvents.length > 0 && (
            <span className="shrink-0 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              Past
            </span>
          )}
          {pastEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setScope(event.id)}
              className={cn(
                'inline-flex h-7 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 truncate whitespace-nowrap rounded-full px-3 text-[11px] font-semibold transition-colors duration-150',
                scope === event.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CheckCircle2 size={11} />
              {event.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable member list */}
      <div className="min-h-0 flex-1 overflow-auto pb-4 pt-3">
        {filteredRows.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title={searchQuery ? 'No members found' : 'Nobody here yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search'
                  : scopedEvent
                    ? `No one is ${isPastScope ? 'recorded as attending' : 'signed up for'} this event yet.`
                    : 'Add someone to one of your events to start building your community.'
              }
              action={!searchQuery ? { label: 'Add Member', onClick: handleCreateUser } : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredRows.map((row) => (
              <MemberCard
                key={row.user.id}
                row={row}
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
