"use client"

import * as React from "react"


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import {
    TerminalSquareIcon,
    BotIcon,
    BookOpen,
    Settings2Icon,
    FrameIcon,
    PieChartIcon,
    MapIcon,
    ChevronsUpDownIcon,
    ChevronRightIcon,
} from "lucide-react"
import { useLocation, useNavigate } from "@tanstack/react-router"

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
        },
        {
            label: "Evil Corp.",
            plan: "Free",
        },
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
                    label: "Starred",
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
                },
                {
                    label: "Tutorials",
                    url: "#",
                },
                {
                    label: "Changelog",
                    url: "#",
                },
            ],
        },
        {
            label: "Settings",
            url: "#",
            icon: Settings2Icon,
            items: [
                {
                    label: "General",
                    url: "#",
                },
                {
                    label: "Team",
                    url: "#",
                },
                {
                    label: "Billing",
                    url: "#",
                },
                {
                    label: "Limits",
                    url: "#",
                },
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
            },
            {
                label: "Travel",
                url: "#",
                icon: MapIcon,
            },
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
    const isActive = (url: string) => location.pathname === url

    const [activeTeam, setActiveTeam] = React.useState(teams?.[0] || {
        label: "Acme Inc",
        plan: "Enterprise",
    })


    const navMain = React.useMemo(() => nav?.main || [], [nav]);
    const navs = React.useMemo(() => {
        return Object.entries(nav || {}).filter(([key]) => key !== 'main') || []
    }, [nav]);


    return (
        <SidebarProvider>
            <Sidebar collapsible="icon" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    >
                                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="size-4">
                                                <rect width="256" height="256" fill="none"></rect>
                                                <line
                                                    x1="208"
                                                    y1="128"
                                                    x2="128"
                                                    y2="208"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="32"
                                                ></line>
                                                <line
                                                    x1="192"
                                                    y1="40"
                                                    x2="40"
                                                    y2="192"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="32"
                                                ></line>
                                            </svg>
                                        </div>
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
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Teams</DropdownMenuLabel>
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
                                        <SidebarMenuButton isActive={isActive(item.url)} onClick={() => navigate({ to: item.url })} tooltip={item.label}>
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
                        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
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
                            <DropdownMenu>
                                <DropdownMenuTrigger>
                                    <SidebarMenuButton
                                        size="lg"
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    >
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                                            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.name}</span>
                                            <span className="truncate text-xs">{user?.email}</span>
                                        </div>
                                        <ChevronsUpDownIcon className="ml-auto size-4" />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                                    side="bottom"
                                    align="end"
                                    sideOffset={4}
                                >
                                    <DropdownMenuLabel className="p-0 font-normal">
                                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                            <Avatar className="h-8 w-8 rounded-lg">
                                                <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                                                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">{user?.name}</span>
                                                <span className="truncate text-xs">{user?.email}</span>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>Account</DropdownMenuItem>
                                    <DropdownMenuItem>Billing</DropdownMenuItem>
                                    <DropdownMenuItem>Settings</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>Log out</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            {children}
        </SidebarProvider>
    )
}

export { SidebarInset, SidebarTrigger };

export default MainSidebar;