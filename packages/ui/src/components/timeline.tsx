import * as React from "react"

import { cn } from "../lib/utils"

/**
 * The connector motif: a thin vertical line that joins the dot markers of
 * consecutive rows so a stack reads as one continuous span rather than a set of
 * unrelated rows.
 *
 * Two shapes, because the two places we use it need different things:
 *
 * - `TimelineMarker` — an inline dot with rail segments above and below it. The
 *   segments stretch to fill their row, so the line stays joined no matter how
 *   tall the rows grow. Used for the Start/End pair in the event composer.
 * - `TimelineRail` — a single line drawn behind a stack of rows that already
 *   have their own layout (the event list), where threading a marker column
 *   through each row would mean rebuilding the row.
 */

const RAIL_LINE = "w-px bg-border"

interface TimelineMarkerProps extends React.ComponentProps<"span"> {
  /** Filled reads as "this is the anchor", hollow as "this follows from it". */
  variant?: "filled" | "hollow"
  /** Draw the rail up to the previous marker. */
  connectAbove?: boolean
  /** Draw the rail down to the next marker. */
  connectBelow?: boolean
  /** Extra classes for the dot itself. */
  dotClassName?: string
}

/**
 * A dot with optional rail segments running to its neighbours. Place it as the
 * first child of a row and give the row `items-stretch` so the segments can
 * fill the available height.
 */
function TimelineMarker({
  variant = "filled",
  connectAbove = false,
  connectBelow = false,
  className,
  dotClassName,
  ...props
}: TimelineMarkerProps) {
  return (
    <span
      aria-hidden
      data-slot="timeline-marker"
      className={cn(
        "flex shrink-0 select-none flex-col items-center self-stretch",
        className
      )}
      {...props}
    >
      <span className={cn("flex-1", connectAbove && RAIL_LINE)} />
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          variant === "filled"
            ? "bg-primary"
            : "border-2 border-muted-foreground bg-transparent",
          dotClassName
        )}
      />
      <span className={cn("flex-1", connectBelow && RAIL_LINE)} />
    </span>
  )
}

interface TimelineRailProps extends React.ComponentProps<"span"> {
  /** Distance from the left edge of the positioned parent to the line. */
  inset?: string
  /** Trim the line so it starts/stops inside the first and last rows. */
  insetY?: string
}

/**
 * A line drawn behind a stack of rows. The parent needs `relative`; the rail is
 * absolutely positioned and non-interactive, so it never competes with the row
 * content sitting on top of it.
 */
function TimelineRail({
  inset = "1.75rem",
  insetY = "1.25rem",
  className,
  style,
  ...props
}: TimelineRailProps) {
  return (
    <span
      aria-hidden
      data-slot="timeline-rail"
      className={cn("pointer-events-none absolute z-0", RAIL_LINE, className)}
      style={{ left: inset, top: insetY, bottom: insetY, ...style }}
      {...props}
    />
  )
}

export { TimelineMarker, TimelineRail }
export type { TimelineMarkerProps, TimelineRailProps }
