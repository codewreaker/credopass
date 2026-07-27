import {
    ChevronsUpDownIcon,
    CreditCard,
    HelpCircle,
    LogOut,
    Plus,
    Settings,
    User,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
    clearActiveOrganization,
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
import { Avatar, AvatarFallback } from "@credopass/ui/components/avatar";
import { cn } from "@credopass/ui/lib/utils";
import CredoPassLogoIcon from "../LeftSidebar/brand-icon";
import { supabase } from "../../supabase";
import { useSession } from "../../contexts/session";

/** "Israel Agyeman-Prempeh" → "IA". */
const initialsOf = (name: string | null | undefined, email: string | null | undefined) => {
    const source = name?.trim() || email?.split('@')[0] || '';
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return 'CP';
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
};

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
 */
const OrgSelector: React.FC<{
    onClick?: (org: Organization) => void
    compact?: boolean
}> = ({ onClick, compact = false }) => {
    const navigate = useNavigate();
    const { context, organizationId } = useSession();
    const { data: organizations = [] } = useOrganizations({ enabled: !!context });

    const account = context?.account;
    const activeOrganization = organizations.find((o) => o.id === organizationId) ?? null;

    const handleSelectOrganization = (org: Organization) => {
        setActiveOrganizationId(org.id);
        onClick?.(org);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        clearActiveOrganization();
        navigate({ to: '/login', search: { manual: true, view: 'social', out: true } });
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
                {/* ── Account ── from GET /me/context, never hardcoded ── */}
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="p-0">
                        <div className="flex items-center gap-2 px-2 py-2">
                            <Avatar className="h-8 w-8 border border-border">
                                <AvatarFallback className="text-[0.625rem] font-semibold bg-muted text-muted-foreground">
                                    {initialsOf(account?.displayName, account?.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium leading-none">
                                    {account?.displayName || account?.email?.split('@')[0] || 'Your account'}
                                </span>
                                <span className="truncate text-xs text-muted-foreground leading-none">
                                    {account?.email ?? 'Signed in'}
                                </span>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem
                        onClick={() => navigate({ to: '/account', search: { tab: 'profile' } })}
                        className="gap-2 p-2"
                    >
                        <User className="h-4 w-4" />
                        <span>Account</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: '/upgrade' })} className="gap-2 p-2">
                        <CreditCard className="h-4 w-4" />
                        <span>Billing</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => navigate({ to: '/account', search: { tab: 'settings' } })}
                        className="gap-2 p-2"
                    >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

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
                    onClick={() => navigate({ to: '/onboarding' })}
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

                {/* ── Support & Sign Out ── */}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2">
                    <HelpCircle className="h-4 w-4" />
                    <span>Help & Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="gap-2 p-2 text-destructive focus:text-destructive"
                    onClick={signOut}
                >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
export default OrgSelector;
