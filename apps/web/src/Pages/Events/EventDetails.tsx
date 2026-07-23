import { FC } from 'react';
import type { EventType } from '@credopass/lib/schemas';
import { Badge } from '@credopass/ui/components/badge';
import { Button } from '@credopass/ui/components/button';
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from '@credopass/ui/components/card';
import { MapWithMarker } from '@credopass/ui/components/map-with-marker';
import { Navigation } from 'lucide-react';

interface EventDetailsReadonlyProps {
    event: EventType;
    className?: string;
}

export const EventDetailsReadonly: FC<EventDetailsReadonlyProps> = ({ event, className }) => {
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
        <Card className={`p-2 lg:h-full lg:flex lg:flex-col ${className ?? ''}`} size='sm'>
            <MapWithMarker className="relative z-20 w-full h-[32vh] lg:h-auto lg:flex-1 lg:min-h-[40vh]" />
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
