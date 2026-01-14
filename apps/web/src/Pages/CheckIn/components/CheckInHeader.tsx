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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{eventName}</h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="w-4 h-4" />
            {eventLocation || 'No location'}
          </div>
        </div>
      </div>

      <CheckInCountBadge count={checkInCount} />
    </div>
  );
};

export default CheckInHeader;
