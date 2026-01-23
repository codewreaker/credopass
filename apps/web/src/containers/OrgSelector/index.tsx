import { useEffect, useMemo} from "react";
import { Organization } from "@credopass/lib/schemas";
import { SidebarMenuButton } from "@credopass/ui/components/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@credopass/ui/components/dropdown-menu"

import { cn } from "@credopass/ui/lib/utils";
import { ChevronsUpDownIcon, Plus, Settings } from "lucide-react";
import { useLauncher, useOrganizationStore } from "../../stores/store";
import { launchOrganizationForm } from "../OrganizationForm";
import CredoPassLogoIcon from "../LeftSidebar/brand-icon";
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from "../../lib/tanstack-db";
import { useNavigate } from "@tanstack/react-router";


const OrgSelector: React.FC<{
     onClick?: (org: Organization) => void
}> = ({
     onClick
}) => {


        // Get collections inside component
        const { organizations: organizationCollection } = getCollections();

        // Fetch organizations from API
        const orgsQuery = useLiveQuery((query) =>
            query
                .from({ organizationCollection })
        );
        const organizations = useMemo(() =>
            (orgsQuery.data ?? []) as Organization[]
            , [orgsQuery.data]);

        const { activeOrganizationId, activeOrganization, setActiveOrganization } = useOrganizationStore();
        const navigate = useNavigate();
        const { openLauncher } = useLauncher();



        // Auto-select first organization if none selected
        useEffect(() => {
            if (!activeOrganizationId && organizations.length > 0) {
                setActiveOrganization(organizations[0].id, organizations[0]);
            }
        }, [activeOrganizationId, organizations, setActiveOrganization]);

        const handleSelectOrganization = (org: Organization) => {
            setActiveOrganization(org.id, org);
            onClick?.(org);
        };

        return (
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <SidebarMenuButton
                        size="lg"
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        <CredoPassLogoIcon size={16} />
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">
                                {activeOrganization?.name || 'Select Organization'}
                            </span>
                            <span className="truncate text-xs">
                                {activeOrganization?.plan || 'No org selected'}
                            </span>
                        </div>
                        <ChevronsUpDownIcon className="ml-auto" />
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {organizations.map((org) => (
                        <DropdownMenuItem
                            key={org.id}
                            onClick={() => handleSelectOrganization(org)}
                            className={cn(
                                "gap-2 p-2",
                                activeOrganizationId === org.id && "bg-accent"
                            )}
                        >
                            <div className="flex size-6 items-center justify-center rounded-sm border">
                                {org.name?.charAt(0) || 'O'}
                            </div>
                            <div className="flex flex-col">
                                <span>{org.name}</span>
                                <span className="text-xs text-muted-foreground">{org.plan}</span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => launchOrganizationForm({}, openLauncher)}
                        className="gap-2 p-2"
                    >
                        <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
                            <Plus className="h-4 w-4" />
                        </div>
                        <span>New Organization</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => navigate({ to: '/organizations' })}
                        className="gap-2 p-2"
                    >
                        <div className="flex size-6 items-center justify-center rounded-sm border">
                            <Settings className="h-4 w-4" />
                        </div>
                        <span>Manage Organizations</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
export default OrgSelector;