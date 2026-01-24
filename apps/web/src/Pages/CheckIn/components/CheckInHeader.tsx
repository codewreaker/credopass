import React from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '@credopass/ui';

import { Users } from 'lucide-react';

interface CheckInCountBadgeProps {
  count: number;
}

const CheckInCountBadge: React.FC<CheckInCountBadgeProps> = ({ count }) => {
  return (
    <div className="text-primary-foreground rounded-2xl px-6 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6" />
        <div>
          <p className="text-xs font-medium opacity-90">Check-ins Today</p>
          <p className="text-3xl font-bold">{count}</p>
        </div>
      </div>
    </div>
  );
};

interface CheckInHeaderProps {
  eventName: string;
  eventLocation: string | null;
  checkInCount: number;
  onBack: () => void;
}

const CheckInHeader: React.FC<CheckInHeaderProps> = ({
  eventName,
  eventLocation,
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
        <h1 className="text-xs sm:text-2xl font-bold tracking-tight truncate">{eventName}</h1>
        <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{eventLocation || 'No location'}</span>
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
