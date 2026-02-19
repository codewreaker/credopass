
import { useCallback, useMemo } from 'react';
import {
    Plus,
    UserPlus,
    CalendarsIcon
} from 'lucide-react';
import { launchEventForm } from '../../containers/EventForm/index';
import { useLauncher } from '@credopass/lib/stores';
import { launchUserForm } from '../UserForm';
import { useSidebarTrigger } from '../../../../../packages/lib/src/hooks/use-sidebar-trigger';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { NAV_ITEMS } from '@credopass/lib/constants';
import { useNavigate } from '@tanstack/react-router';

const orgNavItem = NAV_ITEMS.find(({ id }) => (id === 'organizations'));

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
    {
        key: 'organization',
        icon: orgNavItem?.icon,
        label: `View ${orgNavItem?.label}`,
        description: `View and Manage ${orgNavItem?.label}`,
        action: 'manage-org' as const,
    }
] as const;

export default function ActionCards() {
    const { onToggleCollapse } = useSidebarTrigger();
    const { openLauncher } = useLauncher();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

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
                case 'manage-org':
                    navigate({ to: '/organizations' });
                    break
            }
        },
        [openLauncher, onToggleCollapse, navigate],
    );

    const actionCards = useMemo(() => (isMobile ? ACTION_CARDS : ACTION_CARDS.filter(({ key }) => (key !== 'calendar'))), [isMobile])

    {/* Luma-style action cards row */ }
    return (
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {
                actionCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            className="flex items-center gap-3 py-1.5  px-2 border border-border rounded-[0.625rem] bg-card cursor-pointer text-left transition-all duration-150 ease text-foreground hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
                            onClick={() => handleAction(card.action)}
                        >
                            <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
                                {Icon && <Icon size={16} />}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[0.8125rem] font-semibold text-foreground truncate">{card.label}</span>
                                <span className="text-[0.6875rem] text-muted-foreground hidden sm:inline">{card.description}</span>
                            </div>
                        </button>
                    );
                })
            }
        </div>
    )
}