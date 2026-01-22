"use client"

import * as React from "react"
import { useLiveQuery } from '@tanstack/react-db';

import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@credopass/ui/components/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@credopass/ui/components/dropdown-menu"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    SIDEBAR_COOKIE_NAME
} from "@credopass/ui/components/sidebar"
import { type BottomNavItem } from "@credopass/ui/components/bottom-nav"

import {
    TerminalSquareIcon,
    BotIcon,
    BookOpen,
    FrameIcon,
    PieChartIcon,
    ChevronsUpDownIcon,
    ChevronRightIcon,
    Plus,
    Settings,
} from "lucide-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import UserComponent from "../../components/user"
import { cn } from "@credopass/ui/lib/utils"
import { useCookies } from "@credopass/lib/hooks";
import CredoPassLogoIcon from "./brand-icon";
import { getCollections } from "../../lib/tanstack-db";
import { useOrganizationStore, useLauncher } from "../../stores/store";
import { launchOrganizationForm } from "../OrganizationForm";
import type { Organization } from "@credopass/lib/schemas";

interface SidebarMenuItemType {
    label: string
    url: string
    icon?: React.ElementType
    isActive?: boolean
    items?: Array<SidebarMenuItemType>
    secondary?: boolean
}

interface User {
    name: string
    email: string
    avatar: string
}

export interface SidebarProps {
    user?: User;
    nav?: SidebarMenuProps;
    children?: React.ReactNode;
}
interface SidebarMenuProps {
    main: Array<SidebarMenuItemType>;
    [label: string]: Array<SidebarMenuItemType> | undefined;
}

const defaultData: SidebarProps = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    nav: {
        main: [{
            label: "Playground",
            url: "#",
            icon: TerminalSquareIcon,
            items: [
                {
                    label: "History",
                    url: "#",
                },
                {
                    label: "Settings",
                    url: "#",
                },
            ],
        },
        {
            label: "Models",
            url: "#",
            icon: BotIcon,
            items: [
                {
                    label: "Genesis",
                    url: "#",
                },
                {
                    label: "Explorer",
                    url: "#",
                },
                {
                    label: "Quantum",
                    url: "#",
                },
            ],
        },
        {
            label: "Documentation",
            url: "#",
            icon: BookOpen,
            items: [
                {
                    label: "Introduction",
                    url: "#",
                },
                {
                    label: "Get Started",
                    url: "#",
                }
            ],
        }],
        projects: [
            {
                label: "Design Engineering",
                url: "#",
                icon: FrameIcon,
            },
            {
                label: "Sales & Marketing",
                url: "#",
                icon: PieChartIcon,
            }
        ]
    },
}

const MainSidebar: React.FC<SidebarProps> = ({
    nav = defaultData.nav,
    user = defaultData.user,
    children
}) => {

    const navigate = useNavigate();
    const location = useLocation();
    const { openLauncher } = useLauncher();
    const { activeOrganizationId, activeOrganization, setActiveOrganization } = useOrganizationStore();
    
    // Get collections inside component
    const { organizations: organizationCollection } = getCollections();

    // Fetch organizations from API
    const orgsQuery = useLiveQuery((query) =>
        query
            .from({ organizationCollection })
    );
    const organizations = React.useMemo(() => 
        (orgsQuery.data ?? []) as Organization[]
    , [orgsQuery.data]);

    const [sidebarCookie] = useCookies(SIDEBAR_COOKIE_NAME);
    const isOpen = Boolean(sidebarCookie === 'true');

    const isActive = (url: string) => location.pathname === url

    // Auto-select first organization if none selected
    React.useEffect(() => {
        if (!activeOrganizationId && organizations.length > 0) {
            setActiveOrganization(organizations[0].id, organizations[0]);
        }
    }, [activeOrganizationId, organizations, setActiveOrganization]);

    const handleSelectOrganization = (org: Organization) => {
        setActiveOrganization(org.id, org);
    };

    const navMain = React.useMemo(() => nav?.main || [], [nav]);
    const navs = React.useMemo(() => {
        return Object.entries(nav || {}).filter(([key]) => key !== 'main') || []
    }, [nav]);

    // Convert nav items to BottomNavItem format for mobile
    const bottomNavItems = React.useMemo(() => {
        return navMain
            .filter(item => item.icon && item.url) // Only items with icon and url
            .map(item => ({
                label: item.label,
                url: item.url,
                icon: item.icon as React.ElementType
            })) as BottomNavItem[]
    }, [navMain]);

    // Get navigate function from TanStack Router for mobile bottom nav
    const handleNavigate = React.useCallback((url: string) => {
        navigate({ to: url });
    }, [navigate]);

    return (
        <SidebarProvider defaultOpen={isOpen}
            style={{
                // @ts-expect-error: Allow custom CSS variables
                "--sidebar-width": "14rem"
            }}
        >
            <Sidebar collapsible="icon" variant="inset" navItems={bottomNavItems} navigate={handleNavigate} currentPathname={location.pathname}>
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
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
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>

                    <SidebarGroup>
                        <SidebarGroupLabel>Main</SidebarGroupLabel>
                        <SidebarMenu>
                            {navMain.map((item) => (
                                item.items ? (<Collapsible key={item.label} asChild defaultOpen={isActive(item.url)} className="group/collapsible">
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton tooltip={item.label}>
                                                {item.icon && <item.icon size={16} />}
                                                <span>{item.label}</span>
                                                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {item.items?.map((subItem) => (
                                                    <SidebarMenuSubItem key={subItem.label}>
                                                        <SidebarMenuSubButton href={subItem.url}>{subItem.label}</SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </SidebarMenuItem>
                                </Collapsible>) : (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton
                                            className={cn(isActive(item.url) && "border border-solid border-primary", "cursor-pointer")}
                                            isActive={isActive(item.url)}
                                            onClick={() => navigate({ to: item.url })}
                                            tooltip={item.label}
                                        >
                                            {item.icon && <item.icon />}
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            )
                            )}
                        </SidebarMenu>
                    </SidebarGroup>
                    {navs.map(([label, items]) => (
                        <SidebarGroup key={label} className="group-data-[collapsible=icon]:hidden">
                            <SidebarGroupLabel>{`${label}`.toLocaleUpperCase()}</SidebarGroupLabel>
                            <SidebarMenu>
                                {items?.map((item) => (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton isActive={isActive(item.url)} onClick={() => navigate({ to: item.url })} tooltip={item.label}>
                                            {item.icon && <item.icon />}
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    ))}
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <UserComponent user={user} />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            {children}
        </SidebarProvider>
    )
}

export { SidebarInset, SidebarTrigger, CredoPassLogoIcon as BrandIcon };

export default MainSidebar;