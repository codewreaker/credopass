import { useEffect, useMemo } from "react";
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
import {
    ChevronsUpDownIcon,
    Plus,
    Settings,
    User,
    CreditCard,
    LogOut,
    HelpCircle,
} from "lucide-react";
import { useLauncher, useOrganizationStore } from '@credopass/lib/stores';
import { launchOrganizationForm } from "../OrganizationForm";
import { launchSignInForm } from "../SignInModal/index";
import CredoPassLogoIcon from "../LeftSidebar/brand-icon";
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import { useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@credopass/ui/components/avatar";


const OrgSelector: React.FC<{
    onClick?: (org: Organization) => void
    compact?: boolean
}> = ({
    onClick,
    compact = false
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
                <DropdownMenuTrigger render={() => (
                    <SidebarMenuButton
                        size={compact ? "default" : "lg"}
                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                        <CredoPassLogoIcon size={16} />
                        {!compact && (
                            <>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        {activeOrganization?.name || 'Select Organization'}
                                    </span>
                                    <span className="truncate text-xs">
                                        {activeOrganization?.plan || 'No org selected'}
                                    </span>
                                </div>
                                <ChevronsUpDownIcon className="ml-auto" />
                            </>
                        )}
                    </SidebarMenuButton>
                )} />
                <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                >
                    {/* ── User Profile Section ── */}
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="p-0">
                            <div className="flex items-center gap-2 px-2 py-2">
                                <Avatar className="h-8 w-8 border border-border">
                                    <AvatarImage src="/avatars/shadcn.jpg" alt="Israel" />
                                    <AvatarFallback className="text-[0.625rem] font-semibold bg-muted text-muted-foreground">IA</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium leading-none">Israel</span>
                                    <span className="text-xs text-muted-foreground leading-none">iz@credopass.com</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onClick={() => launchSignInForm({}, openLauncher)}
                            className="gap-2 p-2"
                        >
                            <User className="h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 p-2">
                            <CreditCard className="h-4 w-4" />
                            <span>Billing</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 p-2">
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />

                    {/* ── Organizations Section ── */}
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

                    {/* ── Support & Sign Out ── */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 p-2">
                        <HelpCircle className="h-4 w-4" />
                        <span>Help & Support</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 p-2 text-destructive focus:text-destructive">
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
export default OrgSelector;