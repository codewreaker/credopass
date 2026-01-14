"use client"

import * as React from "react"
import { MoreVertical } from "lucide-react"
import { cn } from "../lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface BottomNavItem {
    label: string
    url: string
    icon: React.ElementType
}

export type NavigateFn = (url: string) => void

interface BottomNavMenuButtonProps {
    item: BottomNavItem
    isActive: boolean
    navigate: NavigateFn
    onClick?: () => void
}

interface BottomNavProps {
    items: BottomNavItem[]
    maxVisibleItems?: number
    currentPathname?: string
    /** 
     * Navigation function - pass your router's navigate function here.
     * Falls back to window.location.href if not provided.
     * @example navigate={useNavigate()} // TanStack Router
     */
    navigate?: NavigateFn
}

const defaultNavigate: NavigateFn = (url: string) => {
    window.location.href = url
}

export function BottomNavMenuButton({ item, isActive, navigate, onClick }: BottomNavMenuButtonProps) {
    const onClickHandler = () => {
        navigate(item.url)
        onClick?.();
    }

    return (
        <button
            onClick={onClickHandler}
            className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-16 py-2 px-3 rounded-2xl transition-all duration-200 active:scale-95",
                isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted",
            )}
        >
            <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "stroke-[2.5] scale-110"
            )} />
            <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive && "font-semibold"
            )}>
                {item.label}
            </span>
        </button>
    )
}

export function BottomNav({ 
    items, 
    maxVisibleItems = 5, 
    currentPathname,
    navigate = defaultNavigate 
}: BottomNavProps) {
    const [open, setOpen] = React.useState(false)

    // Get pathname from window if not provided
    const pathname = React.useMemo(() => {
        return currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
    }, [currentPathname])

    const visibleItems = items.slice(0, maxVisibleItems)
    const hiddenItems = items.slice(maxVisibleItems)
    const shouldShowMore = hiddenItems.length > 0

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Gradient fade effect at top */}
            <div className="absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-background to-transparent pointer-events-none" />
            
            {/* Main nav container */}
            <div className="bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
                <div className="flex h-18 items-center justify-around px-2 pb-safe">
                    {visibleItems.map((item) => {
                        const isActive = pathname === item.url;
                        console.log('BottomNav Item:', pathname, 'isActive:', item.url);
                        return (
                            <BottomNavMenuButton 
                                key={item.label} 
                                item={item} 
                                isActive={isActive}
                                navigate={navigate}
                            />
                        )
                    })}

                    {/* More menu for additional items */}
                    {shouldShowMore && (
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger>
                                <button
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1 min-w-16 py-2 px-3 rounded-2xl transition-all duration-200 active:scale-95",
                                        "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted",
                                    )}
                                >
                                    <MoreVertical className="h-5 w-5" />
                                    <span className="text-[10px] font-medium">More</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent 
                                side="top" 
                                align="end" 
                                sideOffset={8}
                                className="w-auto min-w-35 border-border/50 bg-background/95 backdrop-blur-lg p-2 rounded-2xl shadow-xl"
                            >
                                <div className="flex flex-col gap-1">
                                    {hiddenItems.map((item) => {
                                        const isActive = pathname === item.url
                                        return (
                                            <button
                                                key={item.label}
                                                onClick={() => {
                                                    navigate(item.url)
                                                    setOpen(false)
                                                }}
                                                className={cn(
                                                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95",
                                                    isActive 
                                                        ? "text-primary bg-primary/10" 
                                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                                )}
                                            >
                                                <item.icon className={cn(
                                                    "h-5 w-5",
                                                    isActive && "stroke-[2.5]"
                                                )} />
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    isActive && "font-semibold"
                                                )}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </div>
        </nav>
    )
}
