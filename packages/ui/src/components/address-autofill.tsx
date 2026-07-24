'use client';

import * as React from 'react';
import { AddressAutofillCore, SessionToken } from '@mapbox/search-js-core';
import type {
  AddressAutofillRetrieveResponse,
  AddressAutofillSuggestion,
} from '@mapbox/search-js-core';
import { Clock, Loader2, MapPin, Search, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * AddressPicker — Mapbox address search whose listbox lives *inside* our own DOM.
 *
 * We deliberately do not use `<AddressAutofill>` from `@mapbox/search-js-react`.
 * That component wraps the `mapbox-address-autofill` custom element, which does
 * `document.body.appendChild(this.listbox)` — the suggestion listbox ends up a
 * sibling of the app root rather than a descendant of whatever opened it. Inside
 * a modal (base-ui makes everything outside the popup inert and traps focus) the
 * suggestions are unclickable and the input blurs the moment you reach for one.
 * Its listbox carries `z-index: 1000`, which already clears our `z-50` sheet, so
 * stacking was never the problem — modality was.
 *
 * Driving `AddressAutofillCore` ourselves keeps the two-step suggest/retrieve
 * flow (and the session token Mapbox bills against) while letting the list render
 * in normal flow inside the sheet, where it is focusable, clickable and scrollable.
 */

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
const SUGGEST_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

// Native Cookie API utilities
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
};

const setCookie = (name: string, value: string, days = 365): void => {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/${isSecure ? '; secure' : ''}; samesite=lax`;
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
    .replace(/[.,#\-/\\]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
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

/** Create a normalized key from address properties for deduplication */
const createNormalizedKey = (props: any): string => {
  if (!props) return '';
  return [
    normalizeAddressString(props.address_line1),
    normalizeAddressString(props.city),
    normalizeAddressString(props.postcode),
  ]
    .filter(Boolean)
    .join('|');
};

/** Extract properties from a retrieve response safely */
const getPropsFromResponse = (response: AddressAutofillRetrieveResponse | undefined): any | null =>
  response?.features?.[0]?.properties ?? null;

// Storage utilities - read directly from cookies (no caching to avoid stale data)
const getStoredAddresses = (): StoredAddressSnapshot[] => {
  try {
    const stored = getCookie(STORED_ADDRESSES_COOKIE);
    if (!stored) return [];
    const parsed = JSON.parse(decodeURIComponent(stored));

    // Migrate old entries that predate normalizedKey
    return parsed.map((item: any) =>
      item.normalizedKey
        ? item
        : { ...item, normalizedKey: createNormalizedKey(getPropsFromResponse(item.response)) }
    );
  } catch (error) {
    console.warn('[Credopass] Error parsing stored addresses:', error);
    return [];
  }
};

const saveAddressToCookie = (response: AddressAutofillRetrieveResponse): void => {
  try {
    const stored = getStoredAddresses();
    const normalizedKey = createNormalizedKey(getPropsFromResponse(response));

    // Skip if we can't create a valid key
    if (!normalizedKey) {
      console.warn('[Credopass] Could not create normalized key for address');
      return;
    }

    // Move an existing entry back to the front rather than duplicating it
    const existingIndex = stored.findIndex((a) => a.normalizedKey === normalizedKey);
    if (existingIndex !== -1) {
      const [existing] = stored.splice(existingIndex, 1);
      existing.timestamp = Date.now();
      existing.response = response;
      stored.unshift(existing);
      setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(stored), 365);
      return;
    }

    stored.unshift({
      id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      response,
      normalizedKey,
      timestamp: Date.now(),
    });
    setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(stored.slice(0, MAX_STORED_ADDRESSES)), 365);
  } catch (error) {
    console.warn('Failed to store address in cookie:', error);
  }
};

const removeAddressFromCookie = (addressId: string): void => {
  try {
    const stored = getStoredAddresses().filter((a) => a.id !== addressId);
    if (stored.length === 0) {
      removeCookie(STORED_ADDRESSES_COOKIE);
    } else {
      setCookie(STORED_ADDRESSES_COOKIE, JSON.stringify(stored), 365);
    }
  } catch (error) {
    console.warn('Failed to remove address:', error);
  }
};

/** Single-line label for a stored address. */
const getAddressDisplayText = (response: AddressAutofillRetrieveResponse | undefined): string => {
  const props = getPropsFromResponse(response);
  if (!props) return '';
  const line1 = `${props.address_line1 || ''}${props.address_line2 ? ` ${props.address_line2}` : ''}`;
  const cityState = [props.city, props.state].filter(Boolean).join(', ');
  return [line1, cityState, props.postcode].filter(Boolean).join(' ');
};

export interface AddressPickerProps {
  /** Mapbox access token */
  accessToken: string;
  /** Fires when a suggestion is retrieved (this is the response carrying geometry) */
  onChange?: (response: AddressAutofillRetrieveResponse) => void;
  /** Fires on every keystroke so callers can accept free-text locations */
  onInputChange?: (value: string) => void;
  onBlur?: () => void;
  /** Seeds the input — useful when re-opening the popup on an existing value */
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Offer recently used addresses while the input is empty */
  showRecent?: boolean;
  disabled?: boolean;
  /** How many suggestions the API returns (max 10) */
  limit?: number;
  /** ISO 3166 alpha-2 country filter */
  country?: string;
  autoFocus?: boolean;
}

type Row =
  | { kind: 'suggestion'; suggestion: AddressAutofillSuggestion }
  | { kind: 'recent'; snapshot: StoredAddressSnapshot; props: any };

function AddressPicker({
  accessToken,
  onChange,
  onInputChange,
  onBlur,
  defaultValue = '',
  placeholder = 'Search for an address...',
  className,
  showRecent = true,
  disabled = false,
  limit = 6,
  country,
  autoFocus,
}: AddressPickerProps) {
  const [inputValue, setInputValue] = React.useState(defaultValue);
  const [suggestions, setSuggestions] = React.useState<AddressAutofillSuggestion[]>([]);
  const [storedAddresses, setStoredAddresses] = React.useState<StoredAddressSnapshot[]>(() =>
    showRecent ? getStoredAddresses() : []
  );
  const [isSearching, setIsSearching] = React.useState(false);
  const [isRetrieving, setIsRetrieving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const inputRef = React.useRef<HTMLInputElement>(null);
  // One session token per picker instance — this is what Mapbox bills against.
  const sessionTokenRef = React.useRef<SessionToken>(new SessionToken());
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const autofill = React.useMemo(
    () => (accessToken ? new AddressAutofillCore({ accessToken }) : null),
    [accessToken]
  );

  // Drop any in-flight request and pending debounce on unmount.
  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const runSuggest = React.useCallback(
    async (query: string) => {
      if (!autofill) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      setError(null);
      try {
        const result = await autofill.suggest(query, {
          sessionToken: sessionTokenRef.current,
          signal: controller.signal,
          limit,
          ...(country ? { country } : {}),
        });
        if (controller.signal.aborted) return;
        setSuggestions(result.suggestions ?? []);
        setActiveIndex(-1);
      } catch (err) {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        setSuggestions([]);
        setError('Could not reach the address service. You can still type a location.');
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    },
    [autofill, country, limit]
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onInputChange?.(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      setIsSearching(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => runSuggest(query), SUGGEST_DEBOUNCE_MS);
  };

  const applyResponse = React.useCallback(
    (response: AddressAutofillRetrieveResponse, { persist }: { persist: boolean }) => {
      if (persist) {
        saveAddressToCookie(response);
        if (showRecent) setStoredAddresses(getStoredAddresses());
      }
      setInputValue(getAddressDisplayText(response));
      setSuggestions([]);
      setActiveIndex(-1);
      onChange?.(response);
    },
    [onChange, showRecent]
  );

  const handleSelectSuggestion = React.useCallback(
    async (suggestion: AddressAutofillSuggestion) => {
      if (!autofill) return;
      setIsRetrieving(true);
      setError(null);
      try {
        const response = await autofill.retrieve(suggestion, {
          sessionToken: sessionTokenRef.current,
        });
        applyResponse(response, { persist: true });
        // A retrieve closes the billing session; the next search opens a new one.
        sessionTokenRef.current = new SessionToken();
      } catch {
        setError('Could not load that address. Please try another.');
      } finally {
        setIsRetrieving(false);
      }
    },
    [applyResponse, autofill]
  );

  const handleRemoveAddress = React.useCallback((addressId: string) => {
    removeAddressFromCookie(addressId);
    setStoredAddresses(getStoredAddresses());
  }, []);

  const handleClear = () => {
    setInputValue('');
    onInputChange?.('');
    setSuggestions([]);
    setActiveIndex(-1);
    abortRef.current?.abort();
    if (showRecent) setStoredAddresses(getStoredAddresses());
    inputRef.current?.focus();
  };

  // Recents stand in for suggestions while the input is empty.
  const recentRows = React.useMemo<Row[]>(() => {
    if (!showRecent || inputValue.trim().length > 0) return [];
    return storedAddresses
      .map((snapshot) => {
        const props = getPropsFromResponse(snapshot.response);
        return props ? ({ kind: 'recent', snapshot, props } as Row) : null;
      })
      .filter((row): row is Row => row !== null);
  }, [inputValue, showRecent, storedAddresses]);

  const rows = React.useMemo<Row[]>(
    () =>
      suggestions.length > 0
        ? suggestions.map((suggestion) => ({ kind: 'suggestion', suggestion }) as Row)
        : recentRows,
    [recentRows, suggestions]
  );

  const activateRow = (row: Row) => {
    if (row.kind === 'suggestion') {
      handleSelectSuggestion(row.suggestion);
    } else {
      applyResponse(row.snapshot.response, { persist: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      activateRow(rows[activeIndex]);
    } else if (e.key === 'Escape' && suggestions.length > 0) {
      e.preventDefault();
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  if (!accessToken) {
    return (
      <div
        className={cn(
          'w-full rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive',
          className
        )}
      >
        Mapbox access token is not configured — set VITE_MAPBOX_ACCESS_TOKEN to enable address search.
      </div>
    );
  }

  const showRecentHeading = suggestions.length === 0 && recentRows.length > 0;

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-autocomplete="list"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className={cn(
            'h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none',
            'placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {isSearching || isRetrieving ? (
            <Loader2 size={15} className="animate-spin text-muted-foreground" />
          ) : (
            inputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear address"
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={13} />
              </button>
            )
          )}
        </span>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{error}</p>}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {showRecentHeading && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <Clock size={11} className="text-primary" />
              Recent addresses
            </div>
          )}
          <ul role="listbox" className="max-h-56 overflow-y-auto overscroll-contain">
            {rows.map((row, index) => {
              const isActive = index === activeIndex;
              const title =
                row.kind === 'suggestion' ? row.suggestion.feature_name : row.props.address_line1;
              const subtitle =
                row.kind === 'suggestion'
                  ? row.suggestion.description || row.suggestion.full_address || ''
                  : [row.props.city, row.props.state, row.props.postcode].filter(Boolean).join(', ');

              return (
                <li
                  key={row.kind === 'suggestion' ? row.suggestion.mapbox_id : row.snapshot.id}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'flex items-center gap-3 border-b border-border/50 px-3.5 last:border-b-0',
                    isActive && 'bg-primary/5'
                  )}
                >
                  {/* The listbox is a descendant of the sheet, so a plain click
                      is enough — no portal to fight for the pointer event. */}
                  <button
                    type="button"
                    onClick={() => activateRow(row)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className="flex min-w-0 flex-1 items-start gap-3 py-3 text-left"
                  >
                    <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{title}</span>
                      {subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                  {row.kind === 'recent' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAddress(row.snapshot.id);
                      }}
                      aria-label="Remove saved address"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export { AddressPicker as default, AddressPicker };
