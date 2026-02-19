"use client"

import React from "react"
import { MoreVertical } from "lucide-react"
import { cn } from "../lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface BottomNavItem {
    label: string
    url: string
    icon: React.ElementType
}

export interface CenterButton {
    label?: string
    icon: React.ElementType
    onClick?: () => void
    url?: string
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
    /**
     * Optional prominent center button that can trigger an action or navigate.
     * When provided, navigation items will be split into left and right sections.
     */
    centerButton?: CenterButton
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
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-2xl transition-all duration-200 active:scale-95",
                isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted",
            )}
        >
            <item.icon className={cn(
                "h-5 w- transition-transform",
                isActive && "stroke-[2.5] scale-110"
            )} />
            <span className="text-[0.4rem] font-medium">
                {item.label}
            </span>
        </button>
    )
}

export function BottomNav({
    items,
    maxVisibleItems = 5,
    currentPathname,
    navigate = defaultNavigate,
    centerButton
}: BottomNavProps) {
    const [open, setOpen] = React.useState(false)

    // Get pathname from window if not provided
    const pathname = React.useMemo(() => {
        return currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
    }, [currentPathname])

    // When center button exists, adjust visible items to accommodate it
    const maxItems = centerButton ? maxVisibleItems - 1 : maxVisibleItems
    const visibleItems = items.slice(0, maxItems)
    const hiddenItems = items.slice(maxItems)
    const shouldShowMore = hiddenItems.length > 0
    
    // Split items for center button layout
    const leftItems = centerButton ? visibleItems.slice(0, Math.ceil(visibleItems.length / 2)) : []
    const rightItems = centerButton ? visibleItems.slice(Math.ceil(visibleItems.length / 2)) : []
    
    const handleCenterButtonClick = () => {
        if (centerButton?.onClick) {
            centerButton.onClick()
        } else if (centerButton?.url) {
            navigate(centerButton.url)
        }
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-2000 sm:hidden">
            {/* Gradient fade effect at top */}
            <div className="absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-background to-transparent pointer-events-none" />

            {/* Main nav container */}
            <div className="bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
                <div className="flex h-1/2 items-center justify-around py-1 pb-safe">
                    {centerButton ? (
                        // Layout with center button
                        <>
                            {/* Left side items */}
                            <div className="flex items-center justify-around flex-1">
                                {leftItems.map((item) => {
                                    const isActive = pathname === item.url;
                                    return (
                                        <BottomNavMenuButton
                                            key={item.label}
                                            item={item}
                                            isActive={isActive}
                                            navigate={navigate}
                                        />
                                    )
                                })}
                            </div>

                            {/* Prominent center button */}
                            <div className="flex items-center justify-center px-4">
                                <button
                                    onClick={handleCenterButtonClick}
                                    className="flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground rounded-full h-12 w-12 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 hover:scale-105 -mt-3"
                                >
                                    <centerButton.icon className="h-6 w-6 stroke-[2.5]" />
                                    {centerButton.label && (
                                        <span className="text-[9px] font-semibold mt-0.5">
                                            {centerButton.label}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Right side items */}
                            <div className="flex items-center justify-around flex-1">
                                {rightItems.map((item) => {
                                    const isActive = pathname === item.url;
                                    return (
                                        <BottomNavMenuButton
                                            key={item.label}
                                            item={item}
                                            isActive={isActive}
                                            navigate={navigate}
                                        />
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        // Default layout without center button
                        visibleItems.map((item) => {
                            const isActive = pathname === item.url;
                            return (
                                <BottomNavMenuButton
                                    key={item.label}
                                    item={item}
                                    isActive={isActive}
                                    navigate={navigate}
                                />
                            )
                        })
                    )}

                    {/* More menu for additional items */}
                    {shouldShowMore && (
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger>
                                <button
                                    className={"flex flex-col items-center justify-center gap-1 min-w-16 py-2 px-3 rounded-2xl transition-all duration-200 active:scale-95 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted"}
                                >
                                    <MoreVertical className="h-3 w-3" />
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
                                                    "h-3 w-3",
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
