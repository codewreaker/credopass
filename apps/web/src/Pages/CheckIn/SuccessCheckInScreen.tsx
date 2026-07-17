import React from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';

interface SuccessCheckInScreenProps {
  user: Partial<User>;
  checkInCount: number;
  eventName: string;
}

const SuccessCheckInScreen: React.FC<SuccessCheckInScreenProps> = ({
  user,
  checkInCount,
  eventName,
}) => {
  const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Live counter */}
      <div className="absolute top-5 right-5 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Users size={14} className="text-primary" />
        <span className="text-xl font-mono font-semibold tabular-nums text-primary leading-none">
          {checkInCount}
        </span>
        <span className="text-xs text-muted-foreground">today</span>
      </div>

      {/* Success card */}
      <div className="flex flex-col items-center gap-5 w-full max-w-sm px-6">
        {/* Check icon */}
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <CheckCircle2 size={28} className="text-primary" />
        </div>

        {/* Avatar */}
        <div className="flex size-16 items-center justify-center rounded-full bg-card ring-2 ring-border text-xl font-semibold tracking-tight">
          {initials || '?'}
        </div>

        {/* Name */}
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {user.firstName} {user.lastName}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* Details grid */}
        <div className="w-full rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Status</span>
            <span className="text-xs font-medium text-primary">Going ✓</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Check-in time</span>
            <span className="text-xs font-mono font-medium tabular-nums">Today, {timeString}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-muted-foreground">Event</span>
            <span className="text-xs font-medium truncate max-w-[10rem] text-right">{eventName}</span>
          </div>
        </div>

        {/* Return indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Returning to scanner…
        </div>
      </div>
    </div>
  );
};

export default SuccessCheckInScreen;
