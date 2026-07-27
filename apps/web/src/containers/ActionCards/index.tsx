
import { useCallback, useMemo } from 'react';
import {
    CalendarsIcon,
    Building2
} from 'lucide-react';
import { useSidebarTrigger } from '../../../../../packages/lib/src/hooks/use-sidebar-trigger';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { useNavigate } from '@tanstack/react-router';

/** Luma-style action cards (like Invite Guests / Send a Blast / Share Event) */
const ACTION_CARDS = [
    {
        key: 'calendar',
        icon: CalendarsIcon,
        label: 'Calendar View',
        description: 'View your events in calendar view',
        action: 'show-calendar' as const,
    },
    {
        key: 'organization',
        icon: Building2,
        label: 'View Organisations',
        description: 'View and Manage Organisations',
        action: 'manage-org' as const,
    }
] as const;

export default function ActionCards() {
    const { onToggleCollapse } = useSidebarTrigger();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const handleAction = useCallback(
        (action: string) => {
            switch (action) {
                case 'create-event':
                    navigate({ to: '/events/new' });
                    break;
                case 'add-members':
                    navigate({ to: '/attendees/new' });
                    break;
                case 'show-calendar':
                    onToggleCollapse();
                    break
                case 'manage-org':
                    navigate({ to: '/account', search: { tab: 'organizations' } });
                    break
            }
        },
        [onToggleCollapse, navigate],
    );

    const actionCards = useMemo(() => (isMobile ? ACTION_CARDS : ACTION_CARDS.filter(({ key }) => (key !== 'calendar'))), [isMobile])

    {/* Luma-style action cards row */ }
    return (
        <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 md:grid md:gap-3 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] md:overflow-visible md:pb-0 md:mx-0 md:px-0">
            {
                actionCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            className="group flex items-center gap-3 py-2 px-2.5 min-w-[44%] shrink-0 md:min-w-0 md:shrink border border-border rounded-xl bg-card cursor-pointer text-left transition-all duration-200 text-foreground hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-elevation-2 active:scale-[0.98] active:translate-y-0"
                            onClick={() => handleAction(card.action)}
                        >
                            <div className="flex items-center justify-center size-8 md:size-9 rounded-lg bg-primary text-primary-foreground shrink-0 transition-transform duration-200 group-hover:scale-105">
                                {Icon && <Icon size={16} />}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[0.8125rem] font-semibold text-foreground truncate">{card.label}</span>
                                <span className="text-[0.6875rem] text-muted-foreground truncate hidden sm:block">{card.description}</span>
                            </div>
                        </button>
                    );
                })
            }
        </div>
    )
}