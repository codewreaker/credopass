import { FC } from 'react';
import type { EventType } from '@credopass/lib/schemas';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from '@credopass/ui/components/card';
import { MapWithMarker } from '@credopass/ui/components/map-with-marker';
import { Navigation } from 'lucide-react';
import { useGeocodedLocation } from './use-geocoded-location';

interface EventDetailsReadonlyProps {
    event: EventType;
    className?: string;
}

export const EventDetailsReadonly: FC<EventDetailsReadonlyProps> = ({ event, className }) => {
    // Events store a free-text address and no coordinates, so the map has to
    // resolve it. Cached per address string inside the hook.
    const geocode = useGeocodedLocation(event.location);

    const handleNavigate = () => {
        if (!event.location) return;
        
        const address = encodeURIComponent(event.location);
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) {
            window.location.href = `maps://maps.apple.com/?daddr=${address}`;
            setTimeout(() => {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
            }, 500);
        } else if (/android/.test(userAgent)) {
            window.location.href = `google.navigation:q=${address}`;
            setTimeout(() => {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
            }, 500);
        } else {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
        }
    };

    // Concrete heights, not `lg:h-full` → `lg:flex-1`: that chain resolves to 0
    // whenever an ancestor has no definite height, which made the map vanish
    // entirely at `lg`. `Map` already carries a ResizeObserver, so a real height
    // is all it needs.
    return (
        <Card className={`p-2 ${className ?? ''}`} size='sm'>
            <MapWithMarker
                className="relative z-20 w-full h-[32vh] min-h-60 lg:h-[42vh]"
                points={
                    geocode.status === 'ready'
                        ? [{ id: event.id, name: event.location, lng: geocode.place.lng, lat: geocode.place.lat }]
                        : []
                }
                loading={geocode.status === 'loading'}
                emptyLabel={
                    !event.location
                        ? 'No location set'
                        : geocode.status === 'notfound'
                          ? `Couldn’t place “${event.location}” on the map`
                          : 'Map unavailable'
                }
            />
            <CardHeader>
                <CardAction>
                    <Badge variant="secondary">location</Badge>
                </CardAction>
                <CardTitle>{event.location || 'No location set'}</CardTitle>
            </CardHeader>
            <CardFooter>
                <Button
                    variant="outline"
                    className="w-full gap-2 rounded-full"
                    onClick={handleNavigate}
                    disabled={!event.location}
                >
                    <Navigation size={16} />
                    Navigate
                </Button>
            </CardFooter>
        </Card>
    );
};
