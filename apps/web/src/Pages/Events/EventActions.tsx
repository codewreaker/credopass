import { FC } from 'react';
import { Button } from '@credopass/ui/components/button';
import {
    X as CloseIcon,
    Check as CheckIcon
} from 'lucide-react';

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
