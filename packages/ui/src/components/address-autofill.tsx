'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { AddressAutofill, type AddressAutofillRefType } from '@mapbox/search-js-react';
import type { AddressAutofillRetrieveResponse } from '@mapbox/search-js-core';
import Cookies from 'js-cookie';
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

interface AddressDataForStorage extends AddressData {
  id: string;
  searchText: string;
}

// Constants
const STORED_ADDRESSES_COOKIE = 'credopass_stored_addresses';
const MAX_STORED_ADDRESSES = 5;

// Utility functions
const parseRetrieveResponse = (response: AddressAutofillRetrieveResponse): AddressData => {
  if (!response.features || response.features.length === 0) {
    return {
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      timestamp: Date.now(),
    };
  }

  const feature = response.features[0];
  const props = feature.properties as Record<string, any> || {};

  return {
    addressLine1: props['address_line1'] || '',
    addressLine2: props['address_line2'],
    city: props['city'] || '',
    state: props['state'] || props['region'] || '',
    postalCode: props['postcode'] || '',
    country: props['country'],
    coordinates: feature.geometry?.type === 'Point'
      ? {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      }
      : undefined,
    timestamp: Date.now(),
  };
};

const getStoredAddresses = (): AddressDataForStorage[] => {
  try {
    const stored = Cookies.get(STORED_ADDRESSES_COOKIE);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveAddressToCookie = (address: AddressData, searchText: string): void => {
  try {
    const stored = getStoredAddresses();
    const id = `addr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const filtered = stored.filter(a =>
      !(a.addressLine1 === address.addressLine1 &&
        a.city === address.city &&
        a.state === address.state &&
        a.postalCode === address.postalCode)
    );

    const storableAddress: AddressDataForStorage = {
      ...address,
      id,
      searchText,
    };

    filtered.unshift(storableAddress);
    const toStore = filtered.slice(0, MAX_STORED_ADDRESSES);

    Cookies.set(STORED_ADDRESSES_COOKIE, JSON.stringify(toStore), {
      expires: 365,
      secure: true,
      sameSite: 'Lax',
    });
  } catch (error) {
    console.warn('Failed to store address in cookie:', error);
  }
};

const removeAddressFromCookie = (addressId: string): void => {
  try {
    const stored = getStoredAddresses().filter(a => a.id !== addressId);
    if (stored.length === 0) {
      Cookies.remove(STORED_ADDRESSES_COOKIE);
    } else {
      Cookies.set(STORED_ADDRESSES_COOKIE, JSON.stringify(stored), {
        expires: 365,
        secure: true,
        sameSite: 'Lax',
      });
    }
  } catch (error) {
    console.warn('Failed to remove address:', error);
  }
};

interface AddressAutofillComponentProps
  extends Partial<React.ComponentProps<typeof AddressAutofill>> {
  /**
   * Mapbox access token
   */
  accessToken: string;
  /**
   * Callback when an address is selected
   */
  onChange?: (addressData: AddressData) => void;
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
 * Adds session token management, cookie persistence, and a shadcn-styled dropdown
 * for recent addresses with full inline storage logic.
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
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [searchText, setSearchText] = React.useState('');
    const [storedAddresses, setStoredAddresses] = React.useState<AddressDataForStorage[]>(
      getStoredAddresses
    );

    const sessionToken = React.useMemo(
      () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      []
    );

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

    /**
     * Handle Mapbox address retrieval and save to storage
     */
    const handleRetrieve = useCallback(
      (response: AddressAutofillRetrieveResponse) => {
        const address = parseRetrieveResponse(response);
        saveAddressToCookie(address, searchText);

        // Update stored addresses
        const updated = getStoredAddresses();
        setStoredAddresses(updated);

        onChange?.(address);
        setIsDropdownOpen(false);
        setSearchText('');
      },
      [searchText, onChange]
    );

    /**
     * Handle clicking on a stored address
     */
    const handleSelectStored = useCallback(
      (address: AddressData) => {
        onChange?.(address);
        setIsDropdownOpen(false);
        setSearchText('');
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

    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        <AddressAutofill
          ref={ref}
          accessToken={accessToken}
          onRetrieve={handleRetrieve}
          onSuggest={() => setIsDropdownOpen(true)}
          onSuggestError={() => setIsDropdownOpen(false)}
          {...mapboxProps}
        >
          <input
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="street-address"
            onFocus={() => setIsDropdownOpen(true)}
            onChange={(e) => setSearchText(e.currentTarget.value)}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
            )}
          />
        </AddressAutofill>

        {/* Recent Addresses Dropdown */}
        {isDropdownOpen && showRecent && !searchText && storedAddresses.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
            <div className="sticky top-0 px-4 py-4 text-xs font-bold text-foreground uppercase tracking-wider border-b border-border bg-muted/30 backdrop-blur-sm">
              <Clock className="inline size-4 mr-2.5 text-primary" />
              Recent Addresses
            </div>

            <div>
              {storedAddresses.map((address, index) => (
                <button
                  key={address.id}
                  type="button"
                  className={cn(
                    'w-full px-5 py-4 flex items-start gap-3.5 text-left transition-all duration-200 ease-out group',
                    'hover:bg-primary/5 hover:border-l-2 hover:border-l-primary hover:pl-4',
                    'focus:outline-none focus:bg-primary/5',
                    'active:bg-primary/10',
                    index !== storedAddresses.length - 1 && 'border-b border-border/50'
                  )}
                  onClick={() => handleSelectStored(address)}
                >
                  <svg className="flex-none w-5 h-5 mt-0.5 text-primary/70 group-hover:text-primary transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition-colors">
                      {address.addressLine1}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 group-hover:text-foreground/70 transition-colors leading-relaxed">
                      {[address.city, address.state, address.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'h-8 w-8 p-1.5 rounded-md flex-none ml-2',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                      'hover:bg-destructive/15 text-muted-foreground hover:text-destructive',
                      'focus:outline-none focus:ring-2 focus:ring-destructive/40 focus:opacity-100'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAddress(address.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </button>
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
export type { AddressData };
