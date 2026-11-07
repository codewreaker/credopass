
import { useCallback, useMemo } from 'react';
import {
    CalendarsIcon,
    Building2
} from 'lucide-react';
import { useSidebarTrigger } from '../../../../../packages/lib/src/hooks/use-sidebar-trigger';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { useNavigate } from '@tanstack/react-router';

/**
 * Calendar View and View Organisations.
 *
 * These sit in the events header now, on the same row as the Upcoming ⇄ Past
 * switch, in the space the timezone toggle used to occupy (F4). They used to be
 * a full-width card row below the header, hidden behind a toolbar toggle that
 * most people never found — and the row clipped its second button at the right
 * edge on a 375px screen (UI-REDESIGN §3.1).
 *
 * So they are pills now, not cards: the description line was the only thing
 * making them tall, and it said no more than the label did.
 */
const ACTION_CARDS = [
    {
        key: 'calendar',
        icon: CalendarsIcon,
        label: 'Cal',
        description: 'View your events in calendar view',
        action: 'show-calendar' as const,
    },
    {
        key: 'organization',
        icon: Building2,
        label: 'View Orgs',
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

    return (
        <div className="flex items-center gap-2">
            {
                actionCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            title={card.description}
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-muted-foreground transition-colors duration-150 cursor-pointer hover:border-primary/40 hover:text-foreground active:scale-[0.98]"
                            onClick={() => handleAction(card.action)}
                        >
                            {Icon && <Icon size={13} className="shrink-0" />}
                            <span className="whitespace-nowrap">{card.label}</span>
                        </button>
                    );
                })
            }
        </div>
    )
}