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
        className="shrink-0 -ml-1 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
      </Button>

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold tracking-tight truncate">{eventName}</h1>
          {eventStatus && (
            <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${statusColors[eventStatus] || ''}`}>
              {eventStatus}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
          {eventLocation && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              <span className="truncate">{eventLocation}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users size={14} />
            {eventCapacity ? `${eventCapacity} capacity` : 'Unlimited'}
          </span>
        </div>
      </div>

      {/* Live counter */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card">
        <Users size={16} className="text-primary" />
        <span className="text-2xl font-mono text-primary tabular-nums font-bold leading-none">{checkInCount}</span>
      </div>
    </div>
  );
};

export default CheckInHeader;
