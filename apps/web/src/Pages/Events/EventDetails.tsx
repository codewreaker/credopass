import { FC } from 'react';
import type { EventType } from '@credopass/lib/schemas';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from '@credopass/ui/components/card';
import { MapWithMarker } from '@credopass/ui/components/map-with-marker';
import { Navigation } from 'lucide-react';

interface EventDetailsReadonlyProps {
    event: EventType;
}

export const EventDetailsReadonly: FC<EventDetailsReadonlyProps> = ({ event }) => {
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

    return (
        <Card className="p-2" size='sm'>
            <MapWithMarker className="relative z-20 aspect-video w-full h-[35vh]" />
            <CardHeader>
                <CardAction>
                    <Badge variant="secondary">location</Badge>
                </CardAction>
                <CardTitle>{event.location || 'No location set'}</CardTitle>
            </CardHeader>
            <CardFooter>
                <Button 
                    className="w-full gap-2" 
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
