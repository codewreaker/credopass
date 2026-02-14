import React from 'react';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { Button, Badge } from '@credopass/ui';

interface CheckInHeaderProps {
  eventName: string;
  eventLocation: string | null;
  eventStatus?: string;
  eventCapacity?: number | null;
  checkInCount: number;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/30',
  draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  scheduled: 'bg-primary/10 text-primary border-primary/30',
  ongoing: 'bg-green-500/10 text-green-500 border-green-500/30',
  completed: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
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
    <div className="flex items-center gap-3" data-testid="check-in-header">
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
          <h1 className="text-base font-semibold truncate">{eventName}</h1>
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

      {/* Live counter */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
        <Users size={14} className="text-primary" />
        <span className="text-lg font-bold tabular-nums">{checkInCount}</span>
      </div>
    </div>
  );
};

export default CheckInHeader;
