'use client';

import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { AddressAutofill, type AddressAutofillRefType } from '@mapbox/search-js-react';
import type { AddressAutofillRetrieveResponse } from '@mapbox/search-js-core';
import { Clock, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Types
export interface AddressData {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}

interface StoredAddressSnapshot {
  id: string;
  response: AddressAutofillRetrieveResponse;
  /** Normalized key for fast deduplication */
  normalizedKey: string;
  timestamp: number;
}

// Constants
const STORED_ADDRESSES_COOKIE = 'credopass_stored_addresses';
const MAX_STORED_ADDRESSES = 5;

// Native Cookie API utilities
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
};

const setCookie = (name: string, value: string, days: number = 365): void => {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/${isSecure ? '; secure' : ''}; samesite=lax`;
  document.cookie = cookie;
};

const removeCookie = (name: string): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

/**
 * Normalize an address string for comparison
 * - Lowercase
 * - Remove punctuation and extra whitespace
 * - Standardize common abbreviations
 */
const normalizeAddressString = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,#\-\/\\]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim()
    // Common abbreviations
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bsuite\b/g, 'ste')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w');
};

/**
 * Create a normalized key from address properties for deduplication
 */
const createNormalizedKey = (props: any): string => {
  if (!props) return '';
  const parts = [
    normalizeAddressString(props.address_line1),
    normalizeAddressString(props.city),
    normalizeAddressString(props.postcode),
  ].filter(Boolean);
  return parts.join('|');
};

/**
 * Extract properties from response safely
 */
const getPropsFromResponse = (response: AddressAutofillRetrieveResponse | undefined): any | null => {
  return response?.features?.[0]?.properties ?? null;
};

// Storage utilities - read directly from cookies (no caching to avoid stale data)
const getStoredAddresses = (): StoredAddressSnapshot[] => {
  try {
    const stored = getCookie(STORED_ADDRESSES_COOKIE);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(decodeURIComponent(stored));
    
    // Migrate old entries that don't have normalizedKey
    const migrated = parsed.map((item: any) => {
      if (!item.normalizedKey) {
        const props = getPropsFromResponse(item.response);
        return { ...item, normalizedKey: createNormalizedKey(props) };
      }
      return item;
    });
    
    return migrated;
  } catch (error) {
    console.warn('[Credopass] Error parsing stored addresses:', error);
    return [];
  }
};

const saveAddressToCookie = (response: AddressAutofillRetrieveResponse): void => {
  try {
    const stored = getStoredAddresses();
    const props = getPropsFromResponse(response);
    const normalizedKey = createNormalizedKey(props);
    
    // Skip if we can't create a valid key
    if (!normalizedKey) {
      console.warn('[Credopass] Could not create normalized key for address');
      return;
    }
    
    // Check if this exact address already exists (using normalized comparison)
    const existingIndex = stored.findIndex(a => a.normalizedKey === normalizedKey);
    
    if (existingIndex !== -1) {
      // Move existing entry to front and update timestamp
      const existing = stored[existingIndex];
      stored.splice(existingIndex, 1);
      existing.timestamp = Date.now();
      existing.response = response; // Update with latest response
      stored.unshift(existing);
      setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(stored), 365);
      return;
    }
    
    const id = `addr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const snapshot: StoredAddressSnapshot = {
      id,
      response,
      normalizedKey,
      timestamp: Date.now(),
    };

    stored.unshift(snapshot);
    const toStore = stored.slice(0, MAX_STORED_ADDRESSES);
    setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(toStore), 365);
  } catch (error) {
    console.warn('Failed to store address in cookie:', error);
  }
};

const removeAddressFromCookie = (addressId: string): void => {
  try {
    const stored = getStoredAddresses().filter(a => a.id !== addressId);
    if (stored.length === 0) {
      removeCookie(STORED_ADDRESSES_COOKIE);
    } else {
      setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(stored), 365);
    }
  } catch (error) {
    console.warn('Failed to remove address:', error);
  }
};

// Helper to extract display text from MapBox response
const getAddressDisplayText = (response: AddressAutofillRetrieveResponse | undefined): string => {
  const props = getPropsFromResponse(response);
  if (!props) {
    return '';
  }
  const address_line1 = props.address_line1 || '';
  const address_line2 = props.address_line2 ? ` ${props.address_line2}` : '';
  const city_state = [props.city, props.state].filter(Boolean).join(', ');
  const postcode = props.postcode || '';
  const parts = [address_line1 + address_line2, city_state, postcode].filter(Boolean);
  return parts.join(' ');
};

interface AddressAutofillComponentProps
  extends Omit<Partial<React.ComponentProps<typeof AddressAutofill>>, 'onChange'> {
  /**
   * Mapbox access token
   */
  accessToken: string;
  /**
   * Callback when an address is selected
   */
  onChange?: (response: AddressAutofillRetrieveResponse) => void;
  /**
   * Placeholder text for the input field
   */
  placeholder?: string;
  /**
   * CSS class name for styling
   */
  className?: string;
  /**
   * Show recent addresses when input is empty
   */
  showRecent?: boolean;
  /**
   * Disable the input field
   */
  disabled?: boolean;
}

/**
 * AddressAutofill Component
 *
 * Uses Mapbox's native AddressAutofill component for address search and suggestions.
 * Adds cookie persistence and a shadcn-styled dropdown for recent addresses.
 * MapBox handles all input field updates natively.
 */
const AddressAutofillComponent = React.forwardRef<
  AddressAutofillRefType,
  AddressAutofillComponentProps
>(
  (
    {
      accessToken,
      onChange,
      placeholder = 'Search for an address...',
      className,
      showRecent = true,
      disabled = false,
      ...mapboxProps
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [storedAddresses, setStoredAddresses] = useState<StoredAddressSnapshot[]>(() =>
      getStoredAddresses()
    );

    // Reset dropdown when input changes from MapBox
    const handleInputChange = useCallback((value: string) => {
      setInputValue(value);
      // If user is typing (non-empty), close dropdown. If clearing input, dropdown stays open if focused
      if (value.length > 0) {
        setIsDropdownOpen(false);
      }
    }, []);

    // Refresh stored addresses when dropdown opens
    const handleFocus = useCallback(() => {
      setStoredAddresses(getStoredAddresses());
      setIsDropdownOpen(true);
    }, []);

    /**
     * Handle Mapbox address retrieval and save to storage
     */
    const handleRetrieve = useCallback(
      (response: AddressAutofillRetrieveResponse) => {
        saveAddressToCookie(response);
        const updated = getStoredAddresses();
        setStoredAddresses(updated);

        onChange?.(response);
        setIsDropdownOpen(false);
      },
      [onChange]
    );

    /**
     * Handle clicking on a stored address - restore it to input
     */
    const handleSelectStored = useCallback(
      (response: AddressAutofillRetrieveResponse) => {
        const displayText = getAddressDisplayText(response);
        // Update input with formatted address
        setInputValue(displayText);
        setIsDropdownOpen(false);
        // Call onChange with the response
        onChange?.(response);
      },
      [onChange]
    );

    /**
     * Handle removing a stored address
     */
    const handleRemoveAddress = useCallback((addressId: string) => {
      removeAddressFromCookie(addressId);
      const updated = getStoredAddresses();
      setStoredAddresses(updated);
    }, []);

    /**
     * Close dropdown when clicking outside
     */
    useEffect(() => {
      if (!isDropdownOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    /**
     * Memoized dropdown items to prevent unnecessary re-renders
     */
    const validAddressItems = useMemo(() => {
      return storedAddresses
        .map((item, index) => {
          // Defensive checks for deserialization issues
          if (!item || !item.response || typeof item.response !== 'object') return null;
          const features = (item.response as any).features;
          if (!Array.isArray(features) || !features.length) return null;
          const props = features[0]?.properties;
          if (!props) return null;
          return { item, props, index, isLast: index === storedAddresses.length - 1 };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }, [storedAddresses]);

    if (!accessToken) {
      return (
        <div
          className={cn(
            'w-full p-4 rounded-lg bg-destructive/10 text-destructive text-sm',
            className
          )}
        >
          ⚠️ Mapbox access token is not configured
        </div>
      );
    }

    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        <AddressAutofill
          ref={ref}
          accessToken={accessToken}
          onRetrieve={handleRetrieve}
          onSuggest={() => setIsDropdownOpen(true)}
          onSuggestError={() => setIsDropdownOpen(false)}
          onChange={handleInputChange}
          theme={{
            variables: {
              colorPrimary: '#0ea5e9',
              colorBackground: 'hsl(var(--background))',
              colorText: 'hsl(var(--foreground))',
              fontFamily: 'inherit',
              borderRadius: '0.375rem',
            }
          }}
          {...mapboxProps}
        >
          <input
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="street-address"
            onFocus={handleFocus}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
            )}
          />
        </AddressAutofill>

        {/* Recent Addresses Dropdown */}
        {isDropdownOpen && showRecent && validAddressItems.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
            <div className="sticky top-0 px-4 py-4 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border bg-muted/50">
              <Clock className="inline size-4 mr-2.5 text-primary" />
              Recent Addresses
            </div>

            <div>
              {validAddressItems.map(({ item, props, isLast }) => (
                <div
                  key={item.id}
                  className={cn(
                    'w-full px-5 py-4 flex items-start gap-3.5 text-left transition-all duration-200 ease-out group hover:bg-accent/60 focus-within:outline-none focus-within:bg-accent/40 active:bg-accent/80 cursor-pointer',
                    !isLast && 'border-b border-border/50'
                  )}
                >
                  <button
                    type="button"
                    className="flex-1 flex items-start gap-3.5 text-left min-w-0 focus:outline-none"
                    onClick={() => handleSelectStored(item.response)}
                  >
                    <svg className="flex-none w-5 h-5 mt-0.5 text-primary transition-colors" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0 py-0.5">
                      <p className="font-semibold text-sm leading-snug text-foreground transition-colors">
                        {props.address_line1}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 transition-colors leading-relaxed">
                        {[props.city, props.state, props.postcode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'h-8 w-8 p-1.5 rounded-md flex-none',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                      'hover:bg-destructive/15 text-muted-foreground hover:text-destructive',
                      'focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:opacity-100'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAddress(item.id);
                    }}
                    aria-label="Remove address"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

AddressAutofillComponent.displayName = 'AddressAutofill';

export { AddressAutofillComponent as default };
