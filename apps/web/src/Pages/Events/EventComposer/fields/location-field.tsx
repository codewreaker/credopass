import { useState } from 'react';
import { CheckIcon, MapPin, Video } from 'lucide-react';
import { Input } from '@credopass/ui/components/input';
import { Label } from '@credopass/ui/components/label';
import AddressPicker from '@credopass/ui/components/address-autofill';
import { Button } from '@credopass/ui/components/button';
import { SheetDialog } from '@credopass/ui/components/sheet-dialog';
import { Map, MapMarker, MarkerContent } from '@credopass/ui/components/map';
import type { MapViewport } from '@credopass/ui/components/map';
import { cn } from '@credopass/ui/lib/utils';
import { MAPBOX_ACCESS_TOKEN } from '../../../../config';

interface LocationFieldProps {
  value: string;
  /** The join link for an online or hybrid event (B3/F16). */
  meetingUrl: string;
  onChange: (next: { location: string; meetingUrl: string }) => void;
  invalid?: boolean;
}

/**
 * Accepts an absolute http(s) URL, and only that.
 *
 * Deliberately NOT a regex. `new URL()` is the same parser the browser and the
 * API use, so the three agree on what a link is; a hand-rolled pattern is how
 * the client starts accepting things the server then rejects.
 */
export const isMeetingUrlValid = (raw: string): boolean => {
  const trimmed = raw.trim();
  if (trimmed === '') return true; // absent is fine — the whole point of F16
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

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

const DEFAULT_VIEWPORT: Partial<MapViewport> = { center: [-0.1276, 51.5072], zoom: 11 };

export function LocationField({ value, meetingUrl, onChange, invalid }: LocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [linkDraft, setLinkDraft] = useState(meetingUrl);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [viewport, setViewport] = useState<Partial<MapViewport>>(DEFAULT_VIEWPORT);
  // Remounts the picker per opening so it seeds from the current value and
  // starts a fresh Mapbox session token.
  const [pickerKey, setPickerKey] = useState(0);

  // Seed the draft on open rather than in an effect — nothing external to sync.
  // The pin and viewport are reset too: they used to survive the popup closing, so
  // reopening it showed the *previous* address's preview map until you happened to
  // pick something new — the map looked stuck on one location.
  const openPopup = () => {
    setDraft(value);
    setLinkDraft(meetingUrl);
    setCoordinates(null);
    setViewport(DEFAULT_VIEWPORT);
    setPickerKey((k) => k + 1);
    setOpen(true);
  };

  // Only the address the user just picked has coordinates. Reverse-geocoding a
  // *saved* location used to happen here, in the browser, with a Mapbox token
  // shipped to the client — that moved server-side, onto the write path, and the
  // coordinates it produces are not exposed on the API yet. So an existing
  // location opens without a pin rather than with a guessed one (§2.12).
  const pin = coordinates;
  const pinViewport = viewport;

  const handleRetrieve = (response: any) => {
    setDraft(parseAddress(response));
    const coords = parseCoordinates(response);
    if (coords) {
      setCoordinates(coords);
      setViewport({ center: coords, zoom: 15 });
    }
  };

  const linkValid = isMeetingUrlValid(linkDraft);

  const commit = () => {
    if (!linkValid) return;
    onChange({ location: draft, meetingUrl: linkDraft.trim() });
    setOpen(false);
  };

  // What the collapsed row says it is. An event can be either, both, or — since
  // B3/F16 — neither, and the summary has to read correctly in all four cases.
  const summary = value || meetingUrl || '';
  const subtitle = value && meetingUrl
    ? 'In person and online'
    : meetingUrl
      ? 'Online event'
      : value
        ? 'Tap to change'
        : 'Offline location or virtual link';

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
        {meetingUrl && !value ? (
          <Video size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex flex-col gap-0.5">
          <span className={cn('text-sm font-medium truncate', !summary && 'text-muted-foreground')}>
            {summary || 'Add Event Location'}
          </span>
          <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
        </span>
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Event Location"
        footer={
          <Button size="sm" className="rounded-full px-4" onClick={commit} disabled={!linkValid}>
            <CheckIcon /> Done
          </Button>
        }
        contentClassName="flex flex-col gap-3"
      >
        <AddressPicker
          key={pickerKey}
          accessToken={MAPBOX_ACCESS_TOKEN}
          defaultValue={value}
          onChange={handleRetrieve}
          onInputChange={setDraft}
          placeholder="Search for an address or paste a link"
          showRecent
        />

        {/*
          The virtual link. Separate from the address rather than folded into
          it, because an event can be both — a room and a stream — and a single
          field would force the organiser to pick one to lose.

          Both may now be empty: that is F16. An event can be created before
          anyone has decided where it happens.
        */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meeting-url" className="text-xs text-muted-foreground">
            Virtual link (optional)
          </Label>
          <Input
            id="meeting-url"
            type="url"
            inputMode="url"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="https://meet.example.com/your-event"
            aria-invalid={!linkValid}
          />
          {!linkValid && (
            <p className="text-xs text-destructive">Enter a full link starting with http:// or https://</p>
          )}
        </div>

        {pin ? (
          <div className="h-44 w-full overflow-hidden rounded-xl border border-border">
            <Map viewport={pinViewport} onViewportChange={setViewport}>
              <MapMarker longitude={pin[0]} latitude={pin[1]}>
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
