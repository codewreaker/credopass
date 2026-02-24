import { FC } from 'react';
import type { EventType } from '@credopass/lib/schemas';
import { Button } from '@credopass/ui/components/button';
import {
    CalendarPlus,
    QrCodeIcon,
    UserPlus,
    X as CloseIcon,
    Check as CheckIcon
} from 'lucide-react';

interface EventActionsReadonlyProps {
    event: EventType;
    onRegister: () => void;
    onAddToCalendar: (event: EventType) => void;
    onCheckin: () => void;
}

export const EventActionsReadonly: FC<EventActionsReadonlyProps> = ({
    event,
    onRegister,
    onAddToCalendar,
    onCheckin
}) => {
    const isCancelled = event.status === 'cancelled';
    const isCompleted = event.status === 'completed';

    return (
        <div className="grid grid-cols-3 gap-3">
            <Button
                variant={'default'}
                onClick={onRegister}
                disabled={isCompleted || isCancelled}
            >
                <UserPlus size={18} />
                <span>Register</span>
            </Button>

            <Button
                variant={'outline'}
                onClick={() => onAddToCalendar(event)}
                disabled={isCancelled}
            >
                <CalendarPlus size={18} />
                <span className='truncate'>Add to Calendar</span>
            </Button>

            <Button
                variant={'secondary'}
                onClick={onCheckin}
                disabled={isCompleted || isCancelled}
            >
                <QrCodeIcon size={18} />
                <span>Check In</span>
            </Button>
        </div>
    );
};

interface EventActionsEditProps {
    onCancel: () => void;
    onSave: () => void;
}

export const EventActionsEdit: FC<EventActionsEditProps> = ({ onCancel, onSave }) => {
    return (
        <div className="grid grid-cols-2 gap-3">
            <Button
                variant="outline"
                className="w-full"
                onClick={onCancel}
            >
                <CloseIcon size={16} className="mr-2" />
                Cancel
            </Button>
            <Button
                variant="default"
                className="w-full"
                onClick={onSave}
            >
                <CheckIcon size={16} className="mr-2" />
                Save Changes
            </Button>
        </div>
    );
};
