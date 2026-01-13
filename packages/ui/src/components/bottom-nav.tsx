"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"
import { cn } from "../lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Button } from "./button"

export interface BottomNavItem {
    label: string
    url: string
    icon: React.ElementType
}

interface BottomNavMenuButtonProps {
    item: BottomNavItem
    isActive: boolean
    onClick?: () => void
}

interface BottomNavProps {
    items: BottomNavItem[]
    maxVisibleItems?: number
    currentPathname?: string
}

const navigate = (url: string) => {
    window.location.href = url
}

export function BottomNavMenuButton({ item, isActive, onClick }: BottomNavMenuButtonProps) {
    const onClickHandler = () => {
        navigate(item.url)
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
        </Button>
    )
}

export function BottomNav({ items, maxVisibleItems = 5, currentPathname }: BottomNavProps) {
    const [open, setOpen] = React.useState(false)

    // Get pathname from window if not provided
    const pathname = React.useMemo(() => {
        return currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
    }, [currentPathname])

    const visibleItems = items.slice(0, maxVisibleItems)
    const hiddenItems = items.slice(maxVisibleItems)
    const shouldShowMore = hiddenItems.length > 0

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar md:hidden">
            <div className="flex h-16 items-center justify-around px-2 pb-safe">
                {visibleItems.map((item) => {
                    const isActive = pathname === item.url
                    return (
                        <BottomNavMenuButton key={item.label} item={item} isActive={isActive} />
                    )
                })}

                {/* More menu for additional items */}
                {shouldShowMore && (
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger>
                            <button
                                className={cn(
                                    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                                    "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                                )}
                            >
                                <MoreVertical className="h-5 w-5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="w-24 border-sidebar-border bg-sidebar p-2">
                            <div className="flex flex-col gap-1">
                                {hiddenItems.map((item) => {
                                    const isActive = pathname === item.url
                                    return (
                                        <BottomNavMenuButton
                                            key={item.label}
                                            item={item}
                                            isActive={isActive}
                                            onClick={() => setOpen(false)}
                                        />
                                    )
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </nav>
    )
}
