import { useState } from 'react';
import { CheckIcon, MapPin } from 'lucide-react';
import AddressPicker from '@credopass/ui/components/address-autofill';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { Map, MapMarker, MarkerContent } from '@credopass/ui/components/map';
import type { MapViewport } from '@credopass/ui/components/map';
import { cn } from '@credopass/ui/lib/utils';
import { MAPBOX_ACCESS_TOKEN } from '../../../../config';

interface LocationFieldProps {
  value: string;
  onChange: (location: string) => void;
  invalid?: boolean;
}

/** Flattens a Mapbox autofill response (or the legacy AddressData shape) to one line. */
export const parseAddress = (response: any): string => {
  try {
    if (Array.isArray(response?.features) && response.features.length > 0) {
      const props = response.features[0].properties;
      if (!props) return '';
      return [props.address_line1, props.address_line2, props.city, props.state, props.postcode, props.country]
        .filter(Boolean)
        .join(', ');
    }

    if (response?.addressLine1) {
      const { addressLine1, addressLine2, city, postalCode, state, country } = response;
      return [addressLine1, addressLine2, city, postalCode, state, country].filter(Boolean).join(', ');
    }

    return '';
  } catch (error) {
    console.error('[LocationField] Error parsing address:', error);
    return '';
  }
};

/** Pulls [lng, lat] out of an autofill response so the preview map can centre on it. */
const parseCoordinates = (response: any): [number, number] | null => {
  const coords = response?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2 && coords.every((n: unknown) => typeof n === 'number')) {
    return [coords[0], coords[1]];
  }
  return null;
};

export function LocationField({ value, onChange, invalid }: LocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [viewport, setViewport] = useState<Partial<MapViewport>>({ center: [-0.1276, 51.5072], zoom: 11 });

  // Seed the draft on open rather than in an effect — nothing external to sync.
  const openPopup = () => {
    setDraft(value);
    setOpen(true);
  };

  const handleRetrieve = (response: any) => {
    setDraft(parseAddress(response));
    const coords = parseCoordinates(response);
    if (coords) {
      setCoordinates(coords);
      setViewport({ center: coords, zoom: 15 });
    }
  };

  const commit = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPopup}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5',
          invalid && 'border-destructive/50'
        )}
      >
        <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className={cn('text-sm font-medium truncate', !value && 'text-muted-foreground')}>
            {value || 'Add Event Location'}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {value ? 'Tap to change' : 'Offline location or virtual link'}
          </span>
        </span>
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Event Location"
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={commit} disabled={!draft.trim()}>
            <CheckIcon /> Done
          </Button>
        }
        contentClassName="flex flex-col gap-3"
      >
        <AddressPicker
          accessToken={MAPBOX_ACCESS_TOKEN}
          onChange={handleRetrieve}
          onInputChange={setDraft}
          placeholder="Search for an address or paste a link"
          showRecent
        />

        {coordinates ? (
          <div className="h-44 w-full overflow-hidden rounded-xl border border-border">
            <Map viewport={viewport} onViewportChange={setViewport}>
              <MapMarker longitude={coordinates[0]} latitude={coordinates[1]}>
                <MarkerContent>
                  <div className="size-4 rounded-full border-2 border-white bg-primary shadow-lg" />
                </MarkerContent>
              </MapMarker>
            </Map>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Pick an address to preview it on the map.
          </p>
        )}
      </SheetDialog>
    </>
  );
}
