import {
    ChevronsUpDownIcon,
    Plus,
    Settings,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
    setActiveOrganizationId,
    useOrganizations,
    type Organization,
} from "@credopass/api-client";
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
import CredoPassLogoIcon from "../LeftSidebar/brand-icon";
import { useSession } from "../../contexts/session";

/**
 * The organization switcher.
 *
 * `GET /organizations` returns the caller's own organizations and nothing else —
 * it is not a directory. That is the fix for the leak where this component
 * listed every organization in the database and auto-selected the first, which
 * is how one account ended up looking at another tenant's events (§2.2, §2.12).
 *
 * The active choice is decided at bootstrap from `/me/context` and remembered
 * per account; switching here only re-points the store. Because the active id is
 * part of every org-scoped query key, that re-keys the cache — no page reload,
 * and no possibility of the previous organization's rows surviving the switch.
 *
 * **Organizations only.** Profile, plan and sign-out used to hang off this menu
 * as well, which put "your account" behind a control labelled with the *org's*
 * name. They live on the top-bar avatar (`containers/UserMenu`) now.
 */
const OrgSelector: React.FC<{
    onClick?: (org: Organization) => void
    compact?: boolean
}> = ({ onClick, compact = false }) => {
    const navigate = useNavigate();
    const { context, organizationId } = useSession();
    const { data: organizations = [] } = useOrganizations({ enabled: !!context });

    const activeOrganization = organizations.find((o) => o.id === organizationId) ?? null;

    const handleSelectOrganization = (org: Organization) => {
        setActiveOrganizationId(org.id);
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
                {/* ── Organizations — yours only ── */}
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
                </DropdownMenuGroup>
                {organizations.map((org) => (
                    <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleSelectOrganization(org)}
                        className={cn(
                            "gap-2 p-2",
                            organizationId === org.id && "bg-accent"
                        )}
                    >
                        <div className="flex size-6 items-center justify-center rounded-sm border">
                            {org.name?.charAt(0) || 'O'}
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate">{org.name}</span>
                            <span className="text-xs text-muted-foreground">{org.role ?? org.plan}</span>
                        </div>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => navigate({ to: '/account', search: { tab: 'organizations' } })}
                    className="gap-2 p-2"
                >
                    <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
                        <Plus className="h-4 w-4" />
                    </div>
                    <span>New Organization</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => navigate({ to: '/account', search: { tab: 'organizations' } })}
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
