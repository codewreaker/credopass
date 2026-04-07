import { FC, useState, useEffect, useRef } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@credopass/ui/components/popover';
import {
    MapPin,
    MinusIcon,
    PlusIcon,
    TicketCheck,
    Search,
    Navigation
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

// Address Picker Component with Google Places-like functionality
interface AddressPickerProps {
    value: string;
    onChange: (address: string) => void;
}

const AddressPicker: FC<AddressPickerProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState(value);
    const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; address: string }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Simulate address search (replace with actual Google Places API)
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        // Debounce search
        const timer = setTimeout(() => {
            // Mock suggestions - replace with Google Places API
            const mockSuggestions = [
                { id: '1', name: 'London Eye', address: 'Riverside Building, County Hall, London SE1 7PB, UK' },
                { id: '2', name: 'Tower of London', address: 'St Katharine\'s & Wapping, London EC3N 4AB, UK' },
                { id: '3', name: 'Buckingham Palace', address: 'Westminster, London SW1A 1AA, UK' },
                { id: '4', name: 'Big Ben', address: 'Westminster, London SW1A 0AA, UK' },
                { id: '5', name: 'Hyde Park', address: 'Hyde Park, London W2 2UH, UK' },
            ].filter(s => 
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.address.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setSuggestions(mockSuggestions);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelect = (suggestion: { name: string; address: string }) => {
        const fullAddress = `${suggestion.name}, ${suggestion.address}`;
        onChange(fullAddress);
        setSearchQuery(fullAddress);
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger render={
                <div className="relative">
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
                            ref={inputRef}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsOpen(true);
                            }}
                            onFocus={() => setIsOpen(true)}
                            placeholder="Search for an address..."
                        />
                        <InputGroupAddon>
                            <Search size={14} className="text-muted-foreground" />
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            } />
            <PopoverContent className="w-[400px] p-0" align="start">
                <div className="max-h-[300px] overflow-auto">
                    {isSearching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Searching...
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="py-2">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                                    onClick={() => handleSelect(suggestion)}
                                >
                                    <div className="flex items-start gap-3">
                                        <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium">{suggestion.name}</p>
                                            <p className="text-xs text-muted-foreground">{suggestion.address}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : searchQuery.length >= 3 ? (
                        <div className="p-4 text-center">
                            <MapPin size={24} className="mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">No addresses found</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="p-4 text-center">
                            <Navigation size={24} className="mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">Start typing to search</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Enter at least 3 characters</p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
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

                {/* Location with Address Picker */}
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400 uppercase tracking-wider">
                        Location
                    </Label>
                    <AddressPicker
                        value={draftData.location || ''}
                        onChange={(address) => onFieldUpdate('location', address)}
                    />
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
