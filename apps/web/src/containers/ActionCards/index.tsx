
import { useCallback } from 'react';
import {
    Plus,
    UserPlus,
    CalendarsIcon
} from 'lucide-react';
import { launchEventForm } from '../../containers/EventForm/index';
import { useLauncher } from '../../stores/store';
import { launchUserForm } from '../UserForm';
import { useSidebarTrigger } from '../../hooks/use-sidebar-trigger';
import './index.css'

/** Luma-style action cards (like Invite Guests / Send a Blast / Share Event) */
const ACTION_CARDS = [
    {
        key: 'create',
        icon: Plus,
        label: 'Create Event',
        description: 'Set up a new event',
        action: 'create-event' as const,
    },
    {
        key: 'user',
        icon: UserPlus,
        label: 'Add New User',
        description: 'View your community',
        action: 'add-members' as const,
    },
    {
        key: 'calendar',
        icon: CalendarsIcon,
        label: 'Calendar View',
        description: 'View your events in calendar view',
        action: 'show-calendar' as const,
    },
] as const;

export default function ActionCards() {
    const { onToggleCollapse } = useSidebarTrigger();
    const { openLauncher } = useLauncher();

    const handleAction = useCallback(
        (action: string) => {
            switch (action) {
                case 'create-event':
                    launchEventForm({ isEditing: false }, openLauncher);
                    break;
                case 'add-members':
                    launchUserForm({ isEditing: false }, openLauncher);
                    break;
                case 'show-calendar':
                    onToggleCollapse();
                    break
            }
        },
        [openLauncher, onToggleCollapse],
    );
    {/* Luma-style action cards row */ }
    return (
        <div className="home-actions">
            {
                ACTION_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            className="home-action-card"
                            onClick={() => handleAction(card.action)}
                        >
                            <div className="home-action-icon">
                                <Icon size={18} />
                            </div>
                            <div className="home-action-text">
                                <span className="home-action-label">{card.label}</span>
                                <span className="home-action-desc">{card.description}</span>
                            </div>
                        </button>
                    );
                })
            }
        </div>
    )
}