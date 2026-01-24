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
    <div className="flex items-center justify-between gap-2" data-testid="check-in-header">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="shrink-0 -ml-2"
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>

      {/* Event info - center */}
      <div className="text-center flex-1 min-w-0">
        <div className="flex items-center justify-center gap-2">
            <p className="text-sm sm:text-xl font-bold tracking-tight truncate text-foreground">{eventName}</p>
          {eventStatus && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusColors[eventStatus] || ''}`}>
              {eventStatus}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 text-muted-foreground text-xs mt-0.5">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{eventLocation || 'No location'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            <span>{eventCapacity || 'Unlimited'}</span>
          </div>
        </div>
      </div>

      {/* Check-in count - compact */}
      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xl font-bold">{checkInCount}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Today</p>
      </div>
    </div>
  );
};

export default CheckInHeader;
