import { FC, useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Search, Clock, Loader2, X } from 'lucide-react';
import { Input } from '@credopass/ui/components/input';
import { Button } from '@credopass/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@credopass/ui/components/popover';
import { cn } from '@credopass/ui/lib/utils';

interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface AddressPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Recent addresses stored in localStorage
const RECENT_ADDRESSES_KEY = 'credopass_recent_addresses';
const MAX_RECENT_ADDRESSES = 5;

const getRecentAddresses = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentAddress = (address: string) => {
  try {
    const recent = getRecentAddresses().filter(a => a !== address);
    recent.unshift(address);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_ADDRESSES)));
  } catch {
    // Ignore storage errors
  }
};

/**
 * AddressPicker - Google-style address autocomplete
 * Uses Google Places Autocomplete API for suggestions
 */
export const AddressPicker: FC<AddressPickerProps> = ({
  value,
  onChange,
  placeholder = "Search for an address...",
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);

  // Load recent addresses on mount
  useEffect(() => {
    setRecentAddresses(getRecentAddresses());
  }, []);

  // Initialize Google Places Autocomplete Service
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.maps?.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
  }, []);

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch suggestions from Google Places API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    // If Google Places API is not available, use mock data
    if (!autocompleteService.current) {
      // Mock suggestions for development
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockSuggestions: AddressSuggestion[] = [
        {
          placeId: '1',
          description: `${query}, London, UK`,
          mainText: query,
          secondaryText: 'London, UK',
        },
        {
          placeId: '2',
          description: `${query} Street, New York, NY, USA`,
          mainText: `${query} Street`,
          secondaryText: 'New York, NY, USA',
        },
        {
          placeId: '3',
          description: `${query} Avenue, San Francisco, CA, USA`,
          mainText: `${query} Avenue`,
          secondaryText: 'San Francisco, CA, USA',
        },
      ];
      
      setSuggestions(mockSuggestions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      autocompleteService.current.getPlacePredictions(
        {
          input: query,
          types: ['address', 'establishment'],
        },
        (predictions, status) => {
          setIsLoading(false);
          
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formatted: AddressSuggestion[] = predictions.map(p => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text || '',
            }));
            setSuggestions(formatted);
          } else {
            setSuggestions([]);
          }
        }
      );
    } catch (error) {
      console.error('Places API error:', error);
      setIsLoading(false);
      setSuggestions([]);
    }
  }, []);

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Select an address
  const handleSelectAddress = (address: string) => {
    setInputValue(address);
    onChange(address);
    saveRecentAddress(address);
    setRecentAddresses(getRecentAddresses());
    setSuggestions([]);
    setOpen(false);
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    onChange('');
    setSuggestions([]);
  };

  const showSuggestions = suggestions.length > 0;
  const showRecent = !inputValue && recentAddresses.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start text-left font-normal h-auto py-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <MapPin className="mr-2 size-4 shrink-0" />
          <span className="truncate flex-1">
            {value || placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex flex-col">
          {/* Search input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Enter address..."
              className="border-0 p-0 h-8 focus-visible:ring-0 shadow-none"
              autoFocus
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleClear}
              >
                <X className="size-3" />
              </Button>
            )}
            {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground ml-2" />}
          </div>

          {/* Suggestions list */}
          <div className="max-h-64 overflow-y-auto">
            {showRecent && (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Recent
                </div>
                {recentAddresses.map((address, idx) => (
                  <button
                    key={`recent-${idx}`}
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                    onClick={() => handleSelectAddress(address)}
                  >
                    <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm truncate">{address}</span>
                  </button>
                ))}
              </>
            )}

            {showSuggestions && (
              <>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                    onClick={() => handleSelectAddress(suggestion.description)}
                  >
                    <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{suggestion.mainText}</p>
                      <p className="text-xs text-muted-foreground truncate">{suggestion.secondaryText}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {inputValue && !isLoading && suggestions.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <p>No addresses found</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => handleSelectAddress(inputValue)}
                >
                  Use &quot;{inputValue}&quot; anyway
                </Button>
              </div>
            )}

            {!inputValue && recentAddresses.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Start typing to search for an address
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddressPicker;
