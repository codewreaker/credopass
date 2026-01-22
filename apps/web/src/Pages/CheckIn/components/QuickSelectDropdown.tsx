import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@credopass/ui';
import type { EventType } from '@credopass/lib/schemas';

interface QuickSelectDropdownProps {
  events: EventType[];
  onEventSelect: (eventId: string | null) => void;
  onCreateEvent: () => void;
  statusColors: Record<string, string>;
}

const QuickSelectDropdown: React.FC<QuickSelectDropdownProps> = ({
  events,
  onEventSelect,
  onCreateEvent,
  statusColors,
}) => {
  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-center flex-wrap pb-4 justify-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-primary" />
          Quick Select
        </CardTitle>
        <CardDescription>
          Choose an event from the dropdown or browse below
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-3">
        <Select onValueChange={onEventSelect}>
          <SelectTrigger className="flex-1 w-full">
            <SelectValue>Select an event...</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  <div className="flex items-center gap-2">
                    <span>{event.name}</span>
                    <Badge variant="outline" className={`text-xs ${statusColors[event.status] || ''}`}>
                      {event.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button onClick={onCreateEvent} variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          New Event
        </Button>
      </CardContent>
    </Card>
  );
};

export default QuickSelectDropdown;
