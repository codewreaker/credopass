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
            aria-current={isActive ? "page" : undefined}
            className={cn(
                "flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5",
                "transition-colors duration-150 active:scale-95",
                isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
            )}
        >
            <item.icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5]")} />
            <span className={cn("text-[0.5625rem] leading-none font-medium", isActive && "font-semibold")}>
                {item.label}
            </span>
        </button>
    )
}

/**
 * The mobile tab bar.
 *
 * WHAT CHANGED AND WHY. This used to be an edge-to-edge bar that hid itself
 * after three seconds of inactivity and came back on the next tap or scroll.
 * It read well in a demo and got in the way in use: the bar you want is the
 * one that is already there, and the auto-hide took the primary action with
 * it, so creating something meant tapping once to summon the bar and again to
 * use it (UI-REDESIGN R4). It is now always present.
 *
 * The shape follows iOS 26's tab bar: a floating, inset glass pill rather than
 * a slab welded to the bottom edge, with the primary action as its own circle
 * beside it. Floating is not only decoration — the page visibly continues
 * underneath, so it reads as an overlay rather than as the end of the content,
 * which matters now that the document itself scrolls (R1).
 */
export function BottomNav({
    items,
    maxVisibleItems = 5,
    currentPathname,
    navigate = defaultNavigate,
    centerButton,
}: BottomNavProps) {
    const [open, setOpen] = React.useState(false)

    // Get pathname from window if not provided
    const pathname = React.useMemo(() => {
        return currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
    }, [currentPathname])

    // No split any more: the primary action is its own circle beside the pill
    // (iOS 26), not a bulge in the middle of it. That keeps the tab bar a row
    // of equals and stops the action overlapping the items either side of it.
    const maxItems = maxVisibleItems
    const visibleItems = items.slice(0, maxItems)
    const hiddenItems = items.slice(maxItems)
    const shouldShowMore = hiddenItems.length > 0

    const handleCenterButtonClick = () => {
        if (centerButton?.onClick) {
            centerButton.onClick()
        } else if (centerButton?.url) {
            navigate(centerButton.url)
        }
    }

    // One glass recipe, used by the pill and the action button so they read as
    // the same material. Every part of it is a themed token
    // (packages/ui/src/styles/globals.css), the shadow included.
    //
    // The shadow was a literal here — `0 8px 32px -8px black/35%` — and that is
    // why the bar was easy to miss in light mode: a single shadow that diffuse,
    // cast by near-white glass onto a white page, draws no edge at all. It is
    // now `--glass-shadow`, which is a tight contact shadow plus a soft ambient
    // one in light mode and stays soft in dark, because the two backgrounds
    // need different things and an arbitrary Tailwind value cannot vary by
    // theme.
    const glass = cn(
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "backdrop-blur-[var(--glass-blur)] backdrop-saturate-150",
        "shadow-[var(--glass-shadow)]"
    )

    return (
        <nav
            aria-label="Primary"
            className={cn(
                "pointer-events-none fixed inset-x-0 bottom-0 z-2000 sm:hidden",
                // Clear of the home indicator on a notched phone, and of nothing
                // at all on a device without one.
                "pb-[max(0.5rem,env(safe-area-inset-bottom))] px-3"
            )}
        >
            <div className="pointer-events-auto flex items-center justify-center gap-2">
                <div className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-1", glass)}>
                    {visibleItems.map((item) => (
                        <BottomNavMenuButton
                            key={item.label}
                            item={item}
                            isActive={pathname === item.url}
                            navigate={navigate}
                        />
                    ))}

                    {shouldShowMore && (
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger>
                                <button
                                    aria-label="More"
                                    className="flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
                                >
                                    <MoreVertical className="h-5 w-5 shrink-0" />
                                    <span className="text-[0.5625rem] leading-none font-medium">More</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                side="top"
                                align="end"
                                sideOffset={10}
                                className={cn("w-auto min-w-35 rounded-2xl p-2", glass)}
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
                                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 active:scale-95",
                                                    isActive
                                                        ? "bg-primary/10 text-primary"
                                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                            >
                                                <item.icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
                                                <span className={cn("text-sm font-medium", isActive && "font-semibold")}>
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

                {centerButton && (
                    <button
                        onClick={handleCenterButtonClick}
                        aria-label={centerButton.label ?? "Create"}
                        className={cn(
                            "flex size-13 shrink-0 items-center justify-center rounded-full",
                            "bg-primary text-primary-foreground",
                            // Lime on white needs its own contact shadow for
                            // the same reason the pill does.
                            "shadow-[var(--glass-shadow)]",
                            "ring-1 ring-black/5 dark:ring-white/10",
                            "transition-transform duration-150 active:scale-95"
                        )}
                    >
                        <centerButton.icon className="h-6 w-6 stroke-[2.5]" />
                    </button>
                )}
            </div>
        </nav>
    )
}
