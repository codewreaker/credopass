"use client"

import * as React from "react"


import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@credopass/ui/components/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
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
} from "lucide-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import UserComponent from "../../components/user"
import { cn } from "@credopass/ui/lib/utils"
import { useCookies } from "@credopass/lib/hooks";
import CredoPassLogoIcon from "./brand-icon";

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
    teams?: Array<{ label: string, plan: string }>;
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
    teams: [
        {
            label: "Acme Inc",
            plan: "Enterprise",
        },
        {
            label: "Acme Corp.",
            plan: "Startup",
        }
    ],
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
    teams = defaultData.teams,
    user = defaultData.user,
    children
}) => {

    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarCookie] = useCookies(SIDEBAR_COOKIE_NAME);
    const isOpen = Boolean(sidebarCookie === 'true');

    const isActive = (url: string) => location.pathname === url

    const [activeTeam, setActiveTeam] = React.useState(teams?.[0] || {
        label: "Acme Inc",
        plan: "Enterprise",
    })

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
                                            <span className="truncate font-semibold">{activeTeam?.label}</span>
                                            <span className="truncate text-xs">{activeTeam?.plan}</span>
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
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">Teams</DropdownMenuLabel>
                                    </DropdownMenuGroup>
                                    {teams?.map((team) => (
                                        <DropdownMenuItem key={team.label} onClick={() => setActiveTeam(team)} className="gap-2 p-2">
                                            <div className="flex size-6 items-center justify-center rounded-sm border">
                                                {team.label.charAt(0)}
                                            </div>
                                            {team.label}
                                        </DropdownMenuItem>
                                    ))}
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