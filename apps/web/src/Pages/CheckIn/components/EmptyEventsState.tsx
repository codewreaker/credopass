import React from 'react';
import { QrCodeIcon, Plus } from 'lucide-react';
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@credopass/ui';

interface EmptyEventsStateProps {
  onCreateEvent: () => void;
}

const EmptyEventsState: React.FC<EmptyEventsStateProps> = ({ onCreateEvent }) => {
  return (
    <div className="checkin-page h-full flex flex-col items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-linear-to-br from-primary/20 to-primary/5 p-6 rounded-full">
                <QrCodeIcon className="size-16 text-primary" />
              </div>
            </div>
          </EmptyMedia>
          <EmptyTitle className="text-2xl">No Events Available</EmptyTitle>
          <EmptyDescription className="max-w-md">
            Create your first event to start checking in attendees. Events help you track attendance and engage with your community.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="gap-3">
          <Button onClick={onCreateEvent} size="lg" className="gap-2">
            <Plus className="w-5 h-5" />
            Create New Event
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default EmptyEventsState;
