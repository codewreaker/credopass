import React from 'react';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { Button } from '@credopass/ui/components/button';
import { Badge } from '@credopass/ui/components/badge';

interface CheckInHeaderProps {
  eventName: string;
  eventLocation: string | null;
  eventStatus?: string;
  eventCapacity?: number | null;
  checkInCount: number;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/30',
  draft: 'bg-warning/10 text-warning border-warning/30',
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  ongoing: 'bg-success/10 text-success border-success/30',
  completed: 'bg-info/10 text-info border-info/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
};

const CheckInHeader: React.FC<CheckInHeaderProps> = ({
  eventName,
  eventLocation,
  eventStatus,
  eventCapacity,
  checkInCount,
  onBack,
}) => {
  return (
    <div className="flex min-w-0 items-center gap-2 md:gap-3" data-testid="check-in-header">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0 -ml-1 h-8 w-8"
      >
        <ArrowLeft size={16} />
      </Button>

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base md:text-lg font-semibold tracking-tight truncate">{eventName}</h1>
          {eventStatus && (
            <Badge variant="outline" className={`text-[0.5625rem] px-1.5 py-0 h-4 shrink-0 ${statusColors[eventStatus] || ''}`}>
              {eventStatus}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {eventLocation && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              <span className="truncate">{eventLocation}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={11} />
            {eventCapacity ? `${eventCapacity} capacity` : 'Unlimited'}
          </span>
        </div>
      </div>

      {/* Live counter — compact on mobile so it never overflows a 390px viewport (B7) */}
      <div className="shrink-0 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-full border border-primary/25 bg-primary/10">
        <Users size={13} className="text-primary" />
        <span className="text-base md:text-lg font-bold tabular-nums text-primary">{checkInCount}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">in</span>
      </div>
    </div>
  );
};

export default CheckInHeader;
