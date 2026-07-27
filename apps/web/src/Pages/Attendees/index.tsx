/**
 * `/attendees` — who has been to your events, and who is coming.
 *
 * This page used to derive `standing` and `eventsAttended` in the browser by
 * scanning every attendance row in a full-table cache — roughly 150 lines of
 * `useMemo`. Both values now arrive on the row, already computed (§2.5). The
 * derivation block is gone deliberately: keeping any of it would mean two
 * implementations of `standing`, and they would disagree.
 *
 * One consequence to expect: **"Member" now means "on the roll, hasn't attended
 * yet"**, so the count drops against the old page. That is a correction.
 */

import React, { useCallback, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  useDeletePerson,
  useEvents,
  usePeople,
  usePeopleSummary,
  type PersonRow,
  type Standing,
} from '@credopass/api-client';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Edit,
  Eye,
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
import { Avatar, AvatarFallback } from '@credopass/ui/components/avatar';
import { Button } from '@credopass/ui/components/button';
import { Card } from '@credopass/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@credopass/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@credopass/ui/components/select';
import { toast } from '@credopass/ui/components/sonner';
import { cn } from '@credopass/ui/lib/utils';
import { useCan } from '../../contexts/session';
import { errorMessage } from '../../lib/errors';

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

const MemberCard: React.FC<{
  row: PersonRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (person: PersonRow) => void;
  onDelete: (person: PersonRow) => void;
  onView: (person: PersonRow) => void;
}> = ({ row, canEdit, canDelete, onEdit, onDelete, onView }) => {
  const initials =
    `${row.firstName?.charAt(0) || ''}${row.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
  const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown';
  const config = STANDING_CONFIG[row.standing];
  const StandingIcon = config.icon;

  return (
    <Card
      onClick={() => onView(row)}
      className="group relative cursor-pointer rounded-none border-0 p-4 transition-all duration-200 hover:bg-muted/40 hover:shadow-elevation-1 active:scale-[0.995]"
    >
      <div className="flex items-center gap-3">
        <Avatar size="default" className="shrink-0">
          <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{fullName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.email || 'No email'}</p>
        </div>

        {/* Inline meta — tablet and up */}
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {row.checkInTime && (
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/70">
              <Calendar size={10} />
              {new Date(row.checkInTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
            <Users size={10} className="text-primary" />
            {row.eventsAttended} attended
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
              <DropdownMenuItem onClick={() => onView(row)} className="gap-2">
                <Eye size={14} />
                View Profile
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => onEdit(row)} className="gap-2">
                  <Edit size={14} />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(row)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 size={14} />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
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
          {row.eventsAttended} attended
        </span>
        <ChevronRight size={13} className="ml-auto shrink-0 text-muted-foreground/30" />
      </div>
    </Card>
  );
};

export default function AttendeesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const canCreate = useCan('person:create');
  const canEdit = useCan('person:update');
  const canDelete = useCan('person:delete');

  // Scope lives in the URL so an event's attendee list is shareable and the
  // back button works (the event row / hero card link straight to ?eventId=).
  const { eventId: scopeParam } = useSearch({ from: '/attendees/' });
  const scope = scopeParam ?? 'all';
  const setScope = useCallback(
    (next: string) =>
      navigate({
        to: '/attendees',
        search: next === 'all' ? {} : { eventId: next },
        replace: true,
      }),
    [navigate]
  );

  // Search and event scoping are query parameters — the server filters, not us.
  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
  } = usePeople({
    q: searchQuery.trim() || undefined,
    eventId: scopeParam,
  });
  const { data: summary } = usePeopleSummary(scopeParam);

  // The scope dropdown needs event names. Both groups, because the point of the
  // dropdown is to move between them.
  const { data: upcomingPage } = useEvents({ group: 'upcoming' });
  const { data: pastPage } = useEvents({ group: 'past' });
  const upcomingEvents = upcomingPage?.data ?? [];
  const pastEvents = pastPage?.data ?? [];

  const rows = page?.data ?? [];
  const scopedEvent =
    upcomingEvents.find((e) => e.id === scope) ?? pastEvents.find((e) => e.id === scope) ?? null;
  const isPastScope = !!scopedEvent && pastEvents.some((e) => e.id === scopedEvent.id);

  const deletePerson = useDeletePerson();

  const handleCreateUser = useCallback(() => {
    navigate({
      to: '/attendees/new',
      search: scope === 'all' ? {} : { eventId: scope },
    });
  }, [navigate, scope]);

  const handleEditUser = useCallback(
    (person: PersonRow) => {
      navigate({
        to: '/attendees/$userId/edit',
        params: { userId: person.id },
        search: scope === 'all' ? {} : { eventId: scope },
      });
    },
    [navigate, scope]
  );

  const setViewedItem = useAppStore((st) => st.setViewedItem);
  const toggleSidebar = useAppStore((st) => st.toggleSidebar);

  const handleViewUser = useCallback(
    (person: PersonRow) => {
      setViewedItem({ id: 'profile', content: person });
      toggleSidebar('right', true);
    },
    [setViewedItem, toggleSidebar]
  );

  // Toolbar owns search — no in-page search bar needed
  useToolbarContext({
    action: canCreate
      ? { icon: UserPlus, label: 'Add Attendee', onClick: handleCreateUser }
      : null,
    search: { enabled: true, placeholder: 'Search attendees...', onSearch: setSearchQuery },
  });

  /** Soft delete — they leave the roll, their attendance history survives. */
  const handleDelete = useCallback(
    async (person: PersonRow) => {
      try {
        await deletePerson.mutateAsync(person.id);
        toast.success(`${person.firstName} removed. Their attendance history is kept.`);
      } catch (error) {
        toast.error(errorMessage(error, 'Could not remove that person'));
      }
    },
    [deletePerson]
  );

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
          title="Error Loading Attendees"
          description={errorMessage(error, 'Something went wrong fetching attendees.')}
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      </div>
    );
  }

  // The header, summary billboard and scope dropdown are fixed; only the list
  // beneath scrolls (same pattern as the events list).
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fixed top — header + summary + scope dropdown */}
      <div className="shrink-0">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Attendees</h1>
            <p className="truncate text-sm text-muted-foreground">
              {scopedEvent
                ? `${isPastScope ? 'Who attended' : 'Who is signed up for'} this event`
                : 'Everyone who has been to one of your programmes'}
            </p>
          </div>
          {canCreate && (
            <Button onClick={handleCreateUser} className="shrink-0 gap-2 rounded-full font-semibold">
              <UserPlus size={16} />
              <span className="hidden sm:inline">Add Attendee</span>
            </Button>
          )}
        </div>

        {/* Lime billboard summary. Every number is GET /people/summary — the page
            never counts the rows it happens to be holding. */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-4 text-primary-foreground">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full border-12 border-primary-foreground/8" />
          <div className="relative z-10 flex flex-col gap-3">
            {/* Which event am I looking at? */}
            <span
              className={cn(
                'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                scopedEvent
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary-foreground/10 text-primary-foreground'
              )}
            >
              <CalendarClock size={11} className="shrink-0" />
              <span className="truncate">{scopedEvent ? scopedEvent.name : 'All events'}</span>
            </span>

            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
                  {summary?.total ?? 0}
                </p>
                <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground/60">
                  {scopedEvent ? 'On this event' : 'People'}
                </p>
              </div>
              <div className="flex items-stretch gap-6 border-l border-primary-foreground/15 pl-6">
                {(scopedEvent && isPastScope
                  ? [
                      { label: 'Attended', value: summary?.attended ?? 0 },
                      { label: 'No-shows', value: summary?.noShows ?? 0 },
                    ]
                  : [
                      { label: 'Signed up', value: summary?.signedUp ?? 0 },
                      { label: 'Attended', value: summary?.attended ?? 0 },
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

        {/* Scope switcher — a dropdown: All, or pick one event. */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-3">
          <Select value={scope} onValueChange={(v) => setScope(v ?? 'all')}>
            <SelectTrigger className="h-9 w-full max-w-72 rounded-full text-xs">
              {/* base-ui renders the raw value by default, so map it to the name. */}
              <SelectValue placeholder="All attendees">
                {(value) =>
                  value && value !== 'all'
                    ? ([...upcomingEvents, ...pastEvents].find((e) => e.id === value)?.name ??
                      'Event')
                    : 'All attendees'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All attendees</SelectItem>
              {upcomingEvents.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Upcoming</SelectLabel>
                  {upcomingEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {pastEvents.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Past</SelectLabel>
                  {pastEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
            {rows.length} shown
          </span>
        </div>
      </div>

      {/* Scrolling list — the only scroll region on the page */}
      <div className="min-h-0 flex-1 overflow-auto pb-4 pt-3">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center py-8">
            <EmptyState
              title={searchQuery ? 'No attendees found' : 'Nobody here yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search'
                  : scopedEvent
                    ? `No one is ${isPastScope ? 'recorded as attending' : 'signed up for'} this event yet.`
                    : 'Add someone to one of your events to start building your community.'
              }
              action={
                !searchQuery && canCreate
                  ? { label: 'Add Attendee', onClick: handleCreateUser }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <MemberCard
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={handleEditUser}
                  onDelete={handleDelete}
                  onView={handleViewUser}
                />
              ))}
            </div>
            {page?.page.hasMore && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Showing the first {rows.length}. Narrow the search to find more.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
