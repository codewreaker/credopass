import { FC } from 'react'
import { MapPinOff } from 'lucide-react';
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
} from "@credopass/ui/components/map";
import { cn } from "@credopass/ui/lib/utils";

export interface MapPoint {
  id: string | number;
  name: string;
  lng: number;
  lat: number;
}

export interface MapWithMarkerProps {
  className?: string;
  /** Points to pin. Empty renders the "nothing to show" state, not a stray map. */
  points?: MapPoint[];
  /** Overrides the auto-centre, which is otherwise the first point. */
  center?: [number, number];
  zoom?: number;
  /** Copy for the empty state, e.g. "No location set". */
  emptyLabel?: string;
  /** Renders the empty state as "looking it up" while a lookup is in flight. */
  loading?: boolean;
}

/**
 * A map with pins, driven entirely by props.
 *
 * This component used to hard-code three New York landmarks (Empire State,
 * Central Park, Times Square) plus a fixed centre, so every caller rendered the
 * same view of Manhattan regardless of what it was meant to show — which is why
 * the map looked permanently stuck on one address. It now pins exactly what it is
 * handed, and says so plainly when handed nothing.
 */
export const MapWithMarker: FC<MapWithMarkerProps> = ({
  className,
  points = [],
  center,
  zoom = 14,
  emptyLabel = 'No location to show',
  loading = false,
}) => {
  const resolvedCenter =
    center ?? (points[0] ? ([points[0].lng, points[0].lat] as [number, number]) : null);

  if (!resolvedCenter) {
    return (
      <div
        className={cn(
          'flex h-100 w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted/30 text-muted-foreground',
          className
        )}
      >
        <MapPinOff size={20} className={loading ? 'animate-pulse' : undefined} />
        <p className="px-4 text-center text-xs">
          {loading ? 'Finding this location…' : emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("h-100 w-full", className)}>
      <Map center={resolvedCenter} zoom={zoom}>
        {points.map((point) => (
          <MapMarker key={point.id} longitude={point.lng} latitude={point.lat}>
            <MarkerContent>
              <div className="size-4 rounded-full bg-primary border-2 border-white shadow-lg" />
            </MarkerContent>
            <MarkerTooltip>{point.name}</MarkerTooltip>
            <MarkerPopup>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{point.name}</p>
                <p className="text-xs text-muted-foreground">
                  {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                </p>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
