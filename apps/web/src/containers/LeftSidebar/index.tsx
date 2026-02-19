import * as React from "react"

import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@credopass/ui/components/collapsible"

import {
    Sidebar,
    SidebarContent,
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
    SIDEBAR_COOKIE_NAME,
} from "@credopass/ui/components/sidebar"

import { Kbd, KbdGroup } from '@credopass/ui/components/kbd'
import { type BottomNavItem } from "@credopass/ui/components/bottom-nav"

import { ChevronRightIcon, CirclePlus } from "lucide-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
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

export interface SidebarProps {
    nav?: SidebarMenuProps;
    onCenterClick?: () => void;
    children?: React.ReactNode;
}

interface SidebarMenuProps {
    main: Array<SidebarMenuItemType>;
    [label: string]: Array<SidebarMenuItemType> | undefined;
}

const MainSidebar: React.FC<SidebarProps> = ({
    nav,
    onCenterClick,
    children
}) => {
    const navigate = useNavigate();
    const location = useLocation();


    const [sidebarCookie] = useCookies(SIDEBAR_COOKIE_NAME);
    const isOpen = Boolean(sidebarCookie === 'true');

    const isActive = React.useCallback(
        (url: string) => location.pathname === url,
        [location.pathname]
    );

    const navMain = React.useMemo(() => nav?.main || [], [nav]);

    const navs = React.useMemo(() => {
        return Object.entries(nav || {}).filter(([key]) => key !== 'main') || []
    }, [nav]);

    const bottomNavItems = React.useMemo(() => {
        return navMain
            .filter(item => item.icon && item.url)
            .map(item => ({
                label: item.label,
                url: item.url,
                icon: item.icon as React.ElementType
            })) as BottomNavItem[]
    }, [navMain]);

    const handleNavigate = React.useCallback((url: string) => {
        navigate({ to: url });
    }, [navigate]);

    return (
        <SidebarProvider
            defaultOpen={isOpen}
            style={{
                // @ts-expect-error: Allow custom CSS variables
                "--sidebar-width": "13.5rem"
            }}
        >
            <Sidebar
                collapsible="icon"
                variant="inset"
                navItems={bottomNavItems}
                navigate={handleNavigate}
                currentPathname={location.pathname}
                onCenterClick={onCenterClick}
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <OrgSelector />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-[0.625rem] uppercase tracking-widest text-muted-foreground/60 font-medium">
                            Quick Commands
                        </SidebarGroupLabel>
                        <SidebarMenuItem className="flex items-center gap-2">
                            <SidebarMenuButton
                                tooltip="Quick Create"
                                onClick={onCenterClick}
                                className="bg-secondary text-secondary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                            >
                                <CirclePlus className="text-primary" />
                                <span>Command</span>
                                <KbdGroup>
                                    <Kbd>⌘ + K</Kbd>
                                </KbdGroup>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarGroup>
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-[0.625rem] uppercase tracking-widest text-muted-foreground/60 font-medium">
                            Main
                        </SidebarGroupLabel>
                        <SidebarMenu>
                            {navMain.map((item) => (
                                item.items ? (
                                    <Collapsible
                                        key={item.label}
                                        asChild
                                        defaultOpen={isActive(item.url)}
                                        className="group/collapsible"
                                    >
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
                                                            <SidebarMenuSubButton href={subItem.url}>
                                                                {subItem.label}
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    ))}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                ) : (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton
                                            className={cn(
                                                "cursor-pointer relative transition-all duration-200",
                                                isActive(item.url) && [
                                                    "bg-primary/10 text-primary font-medium",
                                                    "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                                                    "before:h-5 before:w-0.5 before:rounded-full before:bg-primary",
                                                    "before:shadow-[0_0_8px_var(--glow-primary)]",
                                                ]
                                            )}
                                            isActive={isActive(item.url)}
                                            onClick={() => navigate({ to: item.url })}
                                            tooltip={item.label}
                                        >
                                            {item.icon && <item.icon size={16} />}
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>

                    {navs.map(([label, items]) => (
                        <SidebarGroup key={label} className="group-data-[collapsible=icon]:hidden">
                            <SidebarGroupLabel className="text-[0.625rem] uppercase tracking-widest text-muted-foreground/60 font-medium">
                                {label}
                            </SidebarGroupLabel>
                            <SidebarMenu>
                                {items?.map((item) => (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton
                                            className={cn(
                                                "cursor-pointer transition-all duration-200",
                                                isActive(item.url) && "bg-primary/10 text-primary font-medium"
                                            )}
                                            isActive={isActive(item.url)}
                                            onClick={() => navigate({ to: item.url })}
                                            tooltip={item.label}
                                        >
                                            {item.icon && <item.icon size={16} />}
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    ))}
                </SidebarContent>
                <SidebarRail />
            </Sidebar>
            {children}
        </SidebarProvider>
    )
}

export { SidebarInset, SidebarTrigger, CredoPassLogoIcon as BrandIcon, OrgSelector };

export default MainSidebar;
