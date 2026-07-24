"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { useVisualViewport } from "../hooks/use-visual-viewport"

/**
 * SheetDialog — the granular "tap a field, edit one thing" popup.
 *
 * Desktop: a centred modal card. Mobile: anchored to the bottom of the *visual*
 * viewport so it rides above the software keyboard instead of hiding behind it
 * (see useVisualViewport for why 100dvh isn't enough), and capped in height so
 * the content scrolls inside rather than pushing the footer off screen.
 *
 * Unlike the global launcher this is a local, self-contained dialog: mount it
 * next to the trigger that owns it.
 */

interface SheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  /** Rendered in the footer bar, right-aligned. Usually a "Done" button. */
  footer?: React.ReactNode
  /** Rendered in the footer bar, left-aligned. Usually "Reset"/"Clear". */
  footerStart?: React.ReactNode
  showCloseButton?: boolean
  className?: string
  contentClassName?: string
  children?: React.ReactNode
}

const NAVBAR_HEIGHT = 128 // px — offset of the bottom so I can tap the button

function SheetDialog({
  open,
  onOpenChange,
  title,
  footer,
  footerStart,
  showCloseButton = true,
  className,
  contentClassName,
  children,
}: SheetDialogProps) {
  // Only listen while open — no point tracking the keyboard for a closed popup.
  const { keyboardInset, viewportHeight } = useVisualViewport(open)


  const style = {
    "--kb-inset": `${keyboardInset + (open ? NAVBAR_HEIGHT : 0)}px`,
    ...(viewportHeight ? { "--vv-height": `${viewportHeight}px` } : {}),
  } as React.CSSProperties

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="sheet-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/70 duration-150 data-closed:fade-out-0 data-open:fade-in-0 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs"
        />
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none sm:items-center sm:p-4"
          style={style}
        >
          <DialogPrimitive.Popup
            data-slot="sheet-dialog-content"
            className={cn(
              "pointer-events-auto flex w-full flex-col bg-background text-sm outline-none ring-1 ring-foreground/5 shadow-lg duration-150",
              // Mobile: full-width sheet sitting on top of the keyboard.
              "rounded-t-3xl mb-[var(--kb-inset,0px)] max-h-[min(85dvh,calc(var(--vv-height,100dvh)-2rem))]",
              "data-closed:slide-out-to-bottom-4 data-open:slide-in-from-bottom-4",
              // Desktop: centred card.
              "sm:mb-0 sm:max-w-md sm:rounded-4xl sm:max-h-[85dvh] sm:data-closed:zoom-out-95 sm:data-open:zoom-in-95 sm:data-closed:slide-out-to-bottom-0 sm:data-open:slide-in-from-bottom-0",
              "data-closed:fade-out-0 data-open:fade-in-0 data-closed:animate-out data-open:animate-in",
              className
            )}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
                {title ? (
                  <DialogPrimitive.Title className="text-base font-semibold tracking-tight truncate">
                    {title}
                  </DialogPrimitive.Title>
                ) : (
                  <span />
                )}
                {showCloseButton && (
                  <DialogPrimitive.Close
                    render={(props) => (
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <XIcon />
                        <span className="sr-only">Close</span>
                      </Button>
                    )}
                  />
                )}
              </div>
            )}

            <div
              className={cn(
                "flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4",
                contentClassName
              )}
            >
              {children}
            </div>

            {(footer || footerStart) && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 sm:pb-3">
                <div className="flex items-center gap-2">{footerStart}</div>
                <div className="flex items-center gap-2">{footer}</div>
              </div>
            )}
          </DialogPrimitive.Popup>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { SheetDialog }
export type { SheetDialogProps }
