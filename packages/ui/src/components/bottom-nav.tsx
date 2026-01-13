"use client"

import * as React from "react"
import { LayoutGrid, Users, BarChart3, CalendarDays, Table2, MoreHorizontal } from "lucide-react"
import { cn } from "../lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"

interface NavItem {
    label: string
    url: string
    icon: React.ElementType
}

// Main navigation items matching your sidebar
const mainNavItems: NavItem[] = [
    { label: "Home", url: "/", icon: LayoutGrid },
    { label: "Members", url: "/members", icon: Users },
    { label: "Analytics", url: "/analytics", icon: BarChart3 },
    { label: "Events", url: "/events", icon: CalendarDays },
    { label: "Tables", url: "/tables", icon: Table2 },
]

// Items that go into the "More" menu
const moreNavItems: NavItem[] = [{ label: "Components", url: "/components", icon: LayoutGrid }]

const navigate = (options: { to: string }) => {
    window.location.href = options.to
}

export function BottomNavMenuButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
    const onClickHandler = () => {
        navigate({ to: item.url })
        onClick?.();
    }
    return (
        <Button
            variant="link"
            onClick={onClickHandler}
            className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                isActive ? "text-[#d4f542]" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
            )}
        >
            <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
            <span className="truncate">{item.label}</span>
        </Button>)
}

export function BottomNav() {
    const pathname = location.pathname;
    const [open, setOpen] = React.useState(false)

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar md:hidden">
            <div className="flex h-16 items-center justify-around px-2 pb-safe">
                {mainNavItems.slice(0, 4).map((item) => {
                    const isActive = pathname === item.url
                    return (
                        <BottomNavMenuButton key={item.label} item={item} isActive={isActive} />
                    )
                })}

                {/* More menu for additional items */}
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger>
                        <button
                            className={cn(
                                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                                "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                            )}
                        >
                            <MoreHorizontal className="h-5 w-5" />
                            <span>More</span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-48 border-sidebar-border bg-sidebar p-2">
                        <div className="flex flex-col gap-1">
                            {[...mainNavItems.slice(4), ...moreNavItems].map((item) => {
                                const isActive = pathname === item.url
                                return (
                                    <BottomNavMenuButton key={item.label} item={item} isActive={isActive} onClick={() => setOpen(false)} />
                                )
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </nav>
    )
}
