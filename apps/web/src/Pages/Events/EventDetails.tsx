import { FC } from 'react';
import type { EventType } from '@credopass/lib/schemas';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from '@credopass/ui/components/card';
import { Textarea } from '@credopass/ui/components/textarea';
import { Input } from '@credopass/ui/components/input';
import { Label } from '@credopass/ui/components/label';
import { DateTimeRangePicker } from '@credopass/ui/components/date-time-range-picker';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@credopass/ui/components/input-group';
import { ButtonGroup } from '@credopass/ui/components/button-group';
import {
    MapPin,
    MinusIcon,
    PlusIcon,
    TicketCheck
} from 'lucide-react';
import { MapWithMarker } from '@credopass/ui/components/map-with-marker';

interface EventDetailsReadonlyProps {
    event: EventType;
}

export const EventDetailsReadonly: FC<EventDetailsReadonlyProps> = ({ event }) => {
    return (
        <Card className="p-2" size='sm'>
            <MapWithMarker className="relative z-20 aspect-video w-full h-[35vh]" />
            <CardHeader>
                <CardAction>
                    <Badge variant="secondary">location</Badge>
                </CardAction>
                <CardTitle>{event.location}</CardTitle>
            </CardHeader>
            <CardFooter>
                <Button className="w-full">Navigate</Button>
            </CardFooter>
        </Card>
    );
};

interface EventDetailsEditProps {
    draftData: Partial<EventType>;
    onFieldUpdate: (field: keyof EventType, value: any) => void;
    onDateTimeRangeUpdate: (range: { from?: Date; to?: Date } | undefined) => void;
}

export const EventDetailsEdit: FC<EventDetailsEditProps> = ({
    draftData,
    onFieldUpdate,
    onDateTimeRangeUpdate
}) => {
    return (
        <Card className="p-5">
            <CardTitle>Edit Event</CardTitle>
            <div className="space-y-5">
                {/* Event Name */}
                <div className="space-y-2">
                    <InputGroup className="[--radius:9999px]">
                        <InputGroupAddon>
                            <InputGroupButton variant="secondary" size="icon-xs">
                                <TicketCheck />
                            </InputGroupButton>
                        </InputGroupAddon>
                        <InputGroupAddon className="text-muted-foreground pl-1.5">
                            Event Name:
                        </InputGroupAddon>
                        <InputGroupInput
                            id="event-name"
                            value={draftData.name || ''}
                            onChange={(e) => onFieldUpdate('name', e.target.value)}
                        />
                    </InputGroup>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label htmlFor="event-description" className="text-xs text-zinc-400 uppercase tracking-wider">
                        Description
                    </Label>
                    <Textarea
                        id="event-description"
                        value={draftData.description || ''}
                        onChange={(e) => onFieldUpdate('description', e.target.value)}
                        placeholder="Enter event description"
                        rows={6}
                        className="bg-zinc-900/50"
                    />
                </div>

                {/* Date & Time */}
                <div className="space-y-2">
                    <Label htmlFor="event-datetime" className="text-xs text-zinc-400 uppercase tracking-wider">
                        Date & Time
                    </Label>
                    <DateTimeRangePicker
                        id="event-datetime"
                        value={{
                            from: draftData.startTime,
                            to: draftData.endTime,
                        }}
                        onChange={onDateTimeRangeUpdate}
                        className="bg-zinc-900/50"
                    />
                </div>

                {/* Location */}
                <div className="space-y-2">
                    <InputGroup className="[--radius:9999px]">
                        <InputGroupAddon>
                            <InputGroupButton variant="secondary" size="icon-xs">
                                <MapPin />
                            </InputGroupButton>
                        </InputGroupAddon>
                        <InputGroupAddon className="text-muted-foreground pl-1.5">
                            Location:
                        </InputGroupAddon>
                        <InputGroupInput
                            id="event-location"
                            value={draftData.location || ''}
                            onChange={(e) => onFieldUpdate('location', e.target.value)}
                        />
                    </InputGroup>
                </div>

                {/* Capacity */}
                <div className="space-y-2 w-1/2">
                    <Label htmlFor="event-capacity" className="text-xs text-zinc-400 uppercase tracking-wider">
                        Capacity
                    </Label>
                    <ButtonGroup>
                        <Input
                            id="event-capacity"
                            value={draftData.capacity || ''}
                            onChange={(e) => onFieldUpdate('capacity', parseInt(e.target.value) || undefined)}
                            placeholder="Enter max capacity"
                            className="bg-zinc-900/50"
                        />
                        <Button
                            variant="outline"
                            onClick={() => {
                                const current = draftData.capacity || 0;
                                onFieldUpdate('capacity', Math.max(0, current - 1));
                            }}
                            aria-label="Decrease capacity"
                        >
                            <MinusIcon />
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const current = draftData.capacity || 0;
                                onFieldUpdate('capacity', current + 1);
                            }}
                            aria-label="Increase capacity"
                        >
                            <PlusIcon />
                        </Button>
                    </ButtonGroup>
                </div>
            </div>
        </Card>
    );
};
