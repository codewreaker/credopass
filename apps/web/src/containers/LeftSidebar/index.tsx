"use client"

import * as React from "react"

import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@credopass/ui/components/collapsible"

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
    ChevronRightIcon
} from "lucide-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import UserComponent from "../../components/user"
import { useDefaultUserMenu } from "../../components/user/default-menu"
import { cn } from "@credopass/ui/lib/utils"
import { useCookies } from "@credopass/lib/hooks";
import CredoPassLogoIcon from "./brand-icon";
import OrgSelector from "../OrgSelector";

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
    icon?: React.ElementType
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
        name: "israel",
        email: "izzy@credopass.com",
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


    
    const userMenuGroups = useDefaultUserMenu();


    const [sidebarCookie] = useCookies(SIDEBAR_COOKIE_NAME);
    const isOpen = Boolean(sidebarCookie === 'true');

    const isActive = (url: string) => location.pathname === url



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
                            <OrgSelector/>
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
                            <UserComponent user={user} menuGroups={userMenuGroups} />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            {children}
        </SidebarProvider>
    )
}

export { SidebarInset, SidebarTrigger, CredoPassLogoIcon as BrandIcon, OrgSelector };

export default MainSidebar;