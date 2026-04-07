import { FC, useState, useEffect, useRef, useCallback } from 'react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@credopass/ui/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@credopass/ui/components/popover';
import {
    MapPin,
    MinusIcon,
    PlusIcon,
    TicketCheck,
    Search,
    Navigation,
    Loader2,
    History,
    X
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

// Address suggestion type
interface AddressSuggestion {
    id: string;
    mainText: string;
    secondaryText: string;
    fullAddress: string;
}

// Deliveroo-style Address Picker Component
interface AddressPickerProps {
    value: string;
    onChange: (address: string) => void;
    placeholder?: string;
}

const AddressPicker: FC<AddressPickerProps> = ({ value, onChange, placeholder = "Enter your address" }) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentAddresses] = useState<AddressSuggestion[]>([
        { id: 'recent-1', mainText: 'Home', secondaryText: '123 Main Street, London SW1A 1AA', fullAddress: 'Home, 123 Main Street, London SW1A 1AA' },
        { id: 'recent-2', mainText: 'Work', secondaryText: '456 Business Park, London EC2A 1AB', fullAddress: 'Work, 456 Business Park, London EC2A 1AB' },
    ]);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Sync external value changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Simulated address search (replace with Google Places API in production)
    const searchAddresses = useCallback(async (query: string) => {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Mock suggestions based on query
        const mockResults: AddressSuggestion[] = [
            { id: '1', mainText: 'London Eye', secondaryText: 'Riverside Building, County Hall, London SE1 7PB', fullAddress: 'London Eye, Riverside Building, County Hall, London SE1 7PB' },
            { id: '2', mainText: 'Tower of London', secondaryText: "St Katharine's & Wapping, London EC3N 4AB", fullAddress: "Tower of London, St Katharine's & Wapping, London EC3N 4AB" },
            { id: '3', mainText: 'Buckingham Palace', secondaryText: 'Westminster, London SW1A 1AA', fullAddress: 'Buckingham Palace, Westminster, London SW1A 1AA' },
            { id: '4', mainText: 'The Shard', secondaryText: '32 London Bridge St, London SE1 9SG', fullAddress: 'The Shard, 32 London Bridge St, London SE1 9SG' },
            { id: '5', mainText: 'British Museum', secondaryText: 'Great Russell St, London WC1B 3DG', fullAddress: 'British Museum, Great Russell St, London WC1B 3DG' },
            { id: '6', mainText: 'Hyde Park', secondaryText: 'Hyde Park, London W2 2UH', fullAddress: 'Hyde Park, London W2 2UH' },
            { id: '7', mainText: 'Trafalgar Square', secondaryText: 'Trafalgar Square, London WC2N 5DN', fullAddress: 'Trafalgar Square, London WC2N 5DN' },
            { id: '8', mainText: 'Westminster Abbey', secondaryText: '20 Deans Yd, London SW1P 3PA', fullAddress: 'Westminster Abbey, 20 Deans Yd, London SW1P 3PA' },
        ].filter(s => 
            s.mainText.toLowerCase().includes(query.toLowerCase()) ||
            s.secondaryText.toLowerCase().includes(query.toLowerCase())
        );

        setSuggestions(mockResults);
        setIsSearching(false);
    }, []);

    // Debounced search
    const handleInputChange = (newValue: string) => {
        setInputValue(newValue);
        
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            searchAddresses(newValue);
        }, 300);
    };

    const handleSelect = (suggestion: AddressSuggestion) => {
        onChange(suggestion.fullAddress);
        setInputValue(suggestion.fullAddress);
        setOpen(false);
        setSuggestions([]);
    };

    const handleClear = () => {
        setInputValue('');
        onChange('');
        setSuggestions([]);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <div className="flex items-center gap-2 w-full rounded-4xl border border-input bg-transparent px-4 py-3 text-sm shadow-xs transition-all focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-ring/50">
                        <MapPin className="size-5 text-primary shrink-0" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                handleInputChange(e.target.value);
                                if (!open) setOpen(true);
                            }}
                            onFocus={() => setOpen(true)}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                        />
                        {isSearching && (
                            <Loader2 className="size-4 text-muted-foreground animate-spin" />
                        )}
                        {inputValue && !isSearching && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                className="p-1 hover:bg-muted rounded-full transition-colors"
                            >
                                <X className="size-4 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent 
                className="w-[var(--radix-popover-trigger-width)] p-0" 
                align="start"
                sideOffset={4}
            >
                <div className="max-h-[300px] overflow-auto">
                    {/* Recent Addresses */}
                    {!inputValue && recentAddresses.length > 0 && (
                        <div className="p-2">
                            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <History className="size-3" />
                                Recent
                            </div>
                            {recentAddresses.map((address) => (
                                <button
                                    key={address.id}
                                    type="button"
                                    onClick={() => handleSelect(address)}
                                    className="w-full flex items-start gap-3 px-2 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                                >
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <MapPin className="size-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{address.mainText}</p>
                                        <p className="text-xs text-muted-foreground truncate">{address.secondaryText}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search Results */}
                    {inputValue && inputValue.length >= 3 && (
                        <div className="p-2">
                            {isSearching ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                                    <Loader2 className="size-5 animate-spin" />
                                    <span className="text-sm">Searching addresses...</span>
                                </div>
                            ) : suggestions.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        <Search className="size-3" />
                                        Results
                                    </div>
                                    {suggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            onClick={() => handleSelect(suggestion)}
                                            className="w-full flex items-start gap-3 px-2 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                                        >
                                            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                <MapPin className="size-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{suggestion.mainText}</p>
                                                <p className="text-xs text-muted-foreground truncate">{suggestion.secondaryText}</p>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <Navigation className="size-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium">No addresses found</p>
                                    <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Minimum characters hint */}
                    {inputValue && inputValue.length < 3 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Search className="size-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">Keep typing...</p>
                            <p className="text-xs text-muted-foreground mt-1">Enter at least 3 characters to search</p>
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

                {/* Location with Deliveroo-style Address Picker */}
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400 uppercase tracking-wider">
                        Location
                    </Label>
                    <AddressPicker
                        value={draftData.location || ''}
                        onChange={(address) => onFieldUpdate('location', address)}
                        placeholder="Search for a venue or address..."
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
