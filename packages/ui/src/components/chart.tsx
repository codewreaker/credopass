"use client"

import * as React from "react"
import * as echarts from "echarts/core"
import { BarChart as BarSeries, LineChart as LineSeries } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import type { EChartsOption, EChartsType } from "echarts"

import { cn } from "../lib/utils"

/**
 * Charts on Apache ECharts, behind the shadcn chart API.
 *
 * `ChartConfig`, `ChartContainer`, `ChartStyle`, `ChartLegendContent` and the
 * `--color-<key>` token plumbing are unchanged, so consumers keep describing
 * series the same way. What changed is the renderer: Recharts composes a chart
 * out of React children, ECharts takes an option object, so instead of
 * re-exporting primitives this module ships ready-made `<AreaChart>` and
 * `<BarChart>` components that read the same `ChartConfig`.
 *
 * One thing worth knowing: ECharts draws to canvas, and canvas cannot resolve
 * `var(--primary)`. Every colour is therefore resolved against the live computed
 * style before it reaches the option object, and re-resolved when the theme
 * changes — see `useResolvedColor`.
 */

// Only the pieces these charts actually use are registered, so the bundle
// carries a fraction of the full ECharts build.
echarts.use([BarSeries, LineSeries, GridComponent, TooltipComponent, CanvasRenderer])

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

/* -------------------------------------------------------------------------- */
/*  Colour resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Turn a design token into something canvas can paint.
 *
 * `var(--primary)` is meaningless to a canvas fill, so read the custom property
 * off the element the chart lives in. Anything that is already a literal colour
 * passes straight through.
 */
function resolveColor(value: string | undefined, element: HTMLElement | null): string | undefined {
  if (!value) return undefined
  const match = /^var\(\s*(--[^,)\s]+)\s*(?:,\s*(.+))?\)$/.exec(value.trim())
  if (!match) return value

  const [, name, fallback] = match
  const scope = element ?? (typeof document !== "undefined" ? document.documentElement : null)
  if (!scope) return fallback ?? value

  const resolved = getComputedStyle(scope).getPropertyValue(name).trim()
  return resolved || resolveColor(fallback, element) || value
}

/**
 * Bumps whenever the theme changes so colours get re-read.
 *
 * The theme is applied as a class on <html>, and ECharts has already rasterised
 * the old colour by then, so watching the attribute is the only way to know we
 * need to redraw.
 */
function useThemeVersion(): number {
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const observer = new MutationObserver(() => setVersion((v) => v + 1))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    })
    return () => observer.disconnect()
  }, [])

  return version
}

/* -------------------------------------------------------------------------- */
/*  Container                                                                  */
/* -------------------------------------------------------------------------- */

type ChartContainerContextValue = {
  /** The element chart colours should resolve their custom properties against. */
  scope: HTMLDivElement | null
}

const ChartScopeContext = React.createContext<ChartContainerContextValue>({ scope: null })

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`
  const [scope, setScope] = React.useState<HTMLDivElement | null>(null)

  const scopeValue = React.useMemo(() => ({ scope }), [scope])

  return (
    <ChartContext.Provider value={{ config }}>
      <ChartScopeContext.Provider value={scopeValue}>
        <div
          ref={setScope}
          data-slot="chart"
          data-chart={chartId}
          className={cn("flex aspect-video justify-center text-xs", className)}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          {children}
        </div>
      </ChartScopeContext.Provider>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Option-wide colour token resolution                                        */
/* -------------------------------------------------------------------------- */

// Colour-bearing keys in an ECharts option (borrowed from shadcn-echarts).
const COLOR_KEYS = new Set([
  "color", "color0", "borderColor", "borderColor0", "textBorderColor",
  "textShadowColor", "backgroundColor", "areaColor", "fillerColor", "shadowColor",
])

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const needsResolving = (input: string): boolean => {
  const n = input.toLowerCase()
  return n.includes("var(") || n.includes("oklch(") || n.includes("oklab(") || n.includes("color-mix(")
}

/**
 * Resolve one CSS colour string to `rgb()/rgba()` by letting the browser compute
 * it on a throwaway element attached to `scope` — so `var(--token)` resolves in
 * the chart's own cascade, and `oklch()`/`color-mix()` become canvas-safe rgb.
 */
function computeCssColor(value: string, scope: HTMLElement | null): string {
  if (typeof document === "undefined") return value
  const host = scope ?? document.body
  if (!host) return value
  const el = document.createElement("span")
  el.style.color = value
  el.style.position = "absolute"
  el.style.visibility = "hidden"
  el.style.pointerEvents = "none"
  host.appendChild(el)
  const computed = getComputedStyle(el).color
  host.removeChild(el)
  return computed.includes("rgb") ? computed : value
}

const resolveColorString = (value: string, scope: HTMLElement | null): string =>
  needsResolving(value) ? computeCssColor(value, scope) : value

/**
 * Deep-walk an ECharts option, resolving CSS-token colours on known colour keys
 * and inside gradient `colorStops`, so the canvas renderer (which can't read CSS
 * variables) paints the right colours. Returns a new tree — never mutates input.
 */
export function resolveOptionColorTokens<T>(option: T, scope: HTMLElement | null): T {
  const transform = (value: unknown): unknown => {
    if (typeof value === "string") return resolveColorString(value, scope)
    if (Array.isArray(value)) return value.map(transform)
    if (isPlainObject(value)) return walk(value)
    return value
  }

  const walk = (node: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === "colorStops" && Array.isArray(value)) {
        out[key] = value.map((stop) =>
          isPlainObject(stop) && typeof stop.color === "string"
            ? { ...stop, color: resolveColorString(stop.color, scope) }
            : stop
        )
      } else if (COLOR_KEYS.has(key)) {
        out[key] = transform(value)
      } else if (Array.isArray(value)) {
        out[key] = value.map((item) => (isPlainObject(item) ? walk(item) : item))
      } else if (isPlainObject(value)) {
        out[key] = walk(value)
      } else {
        out[key] = value
      }
    }
    return out
  }

  return (isPlainObject(option) ? walk(option) : option) as T
}

/* -------------------------------------------------------------------------- */
/*  BaseChart — the ECharts host                                               */
/* -------------------------------------------------------------------------- */

const hasSeries = (option: EChartsOption): boolean => {
  const s = (option as Record<string, unknown>).series
  return Array.isArray(s) ? s.length > 0 : !!s
}

/** First-frame seed with emptied series data, so bars/lines animate in. */
function mountSeed(option: EChartsOption): EChartsOption {
  const record = option as Record<string, unknown>
  const series = record.series
  const seed = (s: unknown) => (isPlainObject(s) ? { ...s, data: [] } : s)
  return {
    ...record,
    animation: false,
    series: Array.isArray(series) ? series.map(seed) : seed(series),
  } as EChartsOption
}

export interface BaseChartRef {
  getEchartsInstance: () => EChartsType | null
  resize: () => void
}

export interface BaseChartProps extends Omit<React.ComponentProps<"div">, "children" | "onError"> {
  option: EChartsOption
  /** Fixed pixel/CSS height; omit to fill the container (default h-full). */
  height?: number | string
  /** Play a one-time entrance animation on first render (default true). */
  animateOnMount?: boolean
  notMerge?: boolean
  /** Re-applies these components without merging, for count changes. */
  replaceMerge?: string[]
  /** ECharts event handlers, keyed by event name. */
  onEvents?: Record<string, (params: unknown) => void>
}

/**
 * Mounts one ECharts instance and keeps it sized to its container. Pass any
 * ECharts `option` — CSS-token colours are resolved to canvas-safe rgb via
 * `resolveOptionColorTokens`, re-resolved when the theme flips. The higher-level
 * `AreaChart`/`BarChart` presets build their option and render through this.
 */
export const BaseChart = React.forwardRef<BaseChartRef, BaseChartProps>(function BaseChart(
  { option, height, animateOnMount = true, notMerge = false, replaceMerge, onEvents, className, style, ...props },
  ref
) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<EChartsType | null>(null)
  const mountDoneRef = React.useRef(false)
  const themeVersion = useThemeVersion()

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const chart = echarts.init(element, undefined, { renderer: "canvas" })
    chartRef.current = chart

    // ResizeObserver for panel/sidebar resizes; window resize as a fallback.
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element)
    const onResize = () => chart.resize()
    window.addEventListener("resize", onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", onResize)
      chart.dispose()
      chartRef.current = null
      mountDoneRef.current = false
    }
  }, [])

  React.useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return undefined
    for (const [event, handler] of Object.entries(onEvents)) chart.on(event, handler)
    return () => {
      for (const event of Object.keys(onEvents)) chart.off(event)
    }
  }, [onEvents])

  React.useEffect(() => {
    const chart = chartRef.current
    if (!chart) return undefined
    const resolved = resolveOptionColorTokens(option, containerRef.current)
    const apply = () => chart.setOption(resolved, { notMerge, replaceMerge: replaceMerge ?? ["series"] })

    if (animateOnMount && !mountDoneRef.current && hasSeries(resolved)) {
      chart.setOption(mountSeed(resolved), { notMerge: true })
      const timer = window.setTimeout(() => {
        if (chart.isDisposed()) return
        apply()
        mountDoneRef.current = true
      }, 24)
      return () => window.clearTimeout(timer)
    }

    mountDoneRef.current = true
    apply()
    // themeVersion forces a colour re-resolve + re-apply when the theme flips.
    return undefined
  }, [option, notMerge, replaceMerge, animateOnMount, themeVersion])

  React.useImperativeHandle(
    ref,
    () => ({
      getEchartsInstance: () => chartRef.current,
      resize: () => chartRef.current?.resize(),
    }),
    []
  )

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", className)}
      style={{ ...(height != null ? { height } : {}), ...style }}
      {...props}
    />
  )
})

/* -------------------------------------------------------------------------- */
/*  Shared option pieces                                                       */
/* -------------------------------------------------------------------------- */

/** One plotted measure. `key` looks the label and colour up in the ChartConfig. */
export interface ChartSeries {
  key: string
  /** Overrides the colour the ChartConfig would supply. */
  color?: string
  /** Per-category colours, for highlighting a single bar. */
  colors?: (string | undefined)[]
  stackId?: string
}

interface AxisOptions {
  /** Hide the value axis entirely — used by the sparkline in the hero card. */
  hideYAxis?: boolean
  hideXAxis?: boolean
  hideGrid?: boolean
  /** Colour for tick labels; defaults to the chart-axis token. */
  axisColor?: string
  /** Fades the tick labels. Applied after the token resolves, since canvas
      cannot evaluate `color-mix` itself. */
  axisOpacity?: number
  gridColor?: string
}

interface PresetChartProps extends AxisOptions {
  data: Record<string, unknown>[]
  /** Field holding the category for each row. */
  xKey: string
  series: ChartSeries[]
  className?: string
  /** Extra padding around the plot area. */
  grid?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Suppress the tooltip (sparklines don't want one). */
  hideTooltip?: boolean
}

/** Escapes text before it goes into the tooltip's HTML string. */
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  )

/**
 * Builds the shadcn tooltip card as an HTML string.
 *
 * ECharts renders its tooltip outside React, so this mirrors what
 * `ChartTooltipContent` renders rather than reusing the component. Colours are
 * already resolved by the time they get here.
 */
function buildTooltipFormatter(config: ChartConfig) {
  return (params: unknown) => {
    const items = Array.isArray(params) ? params : [params]
    if (items.length === 0) return ""

    const first = items[0] as { axisValueLabel?: string; name?: string }
    const label = escapeHtml(first.axisValueLabel ?? first.name ?? "")

    const rows = items
      .map((raw) => {
        const item = raw as { seriesName?: string; value?: unknown; color?: string }
        const key = item.seriesName ?? ""
        const itemConfig = config[key]
        const name = escapeHtml(
          typeof itemConfig?.label === "string" ? itemConfig.label : key
        )
        const value =
          typeof item.value === "number" ? item.value.toLocaleString() : escapeHtml(item.value)

        return `
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:${escapeHtml(item.color)}"></span>
            <span style="flex:1;opacity:0.7">${name}</span>
            <span style="font-variant-numeric:tabular-nums;font-weight:500">${value}</span>
          </div>`
      })
      .join("")

    return `
      <div style="display:grid;gap:6px;min-width:8rem">
        ${label ? `<div style="font-weight:500">${label}</div>` : ""}
        <div style="display:grid;gap:6px">${rows}</div>
      </div>`
  }
}

/** Tooltip chrome shared by every chart, themed off the design tokens. */
function tooltipOption(
  config: ChartConfig,
  colors: { background: string; foreground: string; border: string },
  extra: Record<string, unknown> = {}
) {
  return {
    trigger: "axis" as const,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    padding: [6, 10],
    extraCssText:
      "border-radius:0.5rem;box-shadow:0 10px 25px -5px rgb(0 0 0 / 0.3);font-size:12px;",
    textStyle: { color: colors.foreground, fontSize: 12 },
    formatter: buildTooltipFormatter(config),
    ...extra,
  }
}

/** Resolves a set of tokens against the container, re-running on theme change. */
function useResolvedColors(names: Record<string, string | undefined>) {
  const { scope } = React.useContext(ChartScopeContext)
  const themeVersion = useThemeVersion()
  const serialized = JSON.stringify(names)

  return React.useMemo(() => {
    // The resolved values are only valid for the theme generation they were read
    // in, so the version participates in the memo even though nothing reads it.
    void themeVersion
    const source = JSON.parse(serialized) as Record<string, string | undefined>
    const resolved: Record<string, string> = {}
    for (const [key, value] of Object.entries(source)) {
      resolved[key] = resolveColor(value, scope) ?? ""
    }
    return resolved
  }, [serialized, scope, themeVersion])
}

/** Colour for a series: explicit override, else the ChartConfig entry. */
const seriesColorToken = (item: ChartSeries, config: ChartConfig): string | undefined =>
  item.color ?? (config[item.key] as { color?: string } | undefined)?.color

function axisCommon(
  hidden: boolean | undefined,
  axisColor: string,
  extra: Record<string, unknown> = {}
) {
  return {
    show: !hidden,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: axisColor, fontSize: 10 },
    ...extra,
  }
}

/* -------------------------------------------------------------------------- */
/*  Chart types                                                                */
/* -------------------------------------------------------------------------- */

interface AreaChartProps extends PresetChartProps {
  /** Gradient fill from this colour down to transparent. */
  fillColor?: string
  strokeWidth?: number
  smooth?: boolean
}

/** Filled line chart. Used for the attendance sparkline in the lime hero. */
function AreaChart({
  data,
  xKey,
  series,
  className,
  grid,
  axisColor = "var(--chart-axis)",
  axisOpacity,
  gridColor = "var(--chart-grid)",
  fillColor,
  strokeWidth = 2.5,
  smooth = true,
  hideXAxis,
  hideYAxis = true,
  hideGrid = true,
  hideTooltip,
}: AreaChartProps) {
  const { config } = useChart()

  const tokens = React.useMemo(() => {
    const map: Record<string, string | undefined> = {
      axis: axisColor,
      grid: gridColor,
      fill: fillColor,
      background: "var(--background)",
      foreground: "var(--foreground)",
      border: "var(--border)",
    }
    series.forEach((item) => {
      map[`series-${item.key}`] = seriesColorToken(item, config)
    })
    return map
  }, [axisColor, config, fillColor, gridColor, series])

  const colors = useResolvedColors(tokens)
  const fadedAxis = axisOpacity ? withAlpha(colors.axis, axisOpacity) : colors.axis

  const option = React.useMemo<EChartsOption>(
    () => ({
      // temporary fix to prevent requestAnimationFrame error that was being cuased
      animation: false,
      animationDuration: 400,
      grid: {
        top: grid?.top ?? 8,
        right: grid?.right ?? 8,
        bottom: grid?.bottom ?? 4,
        left: grid?.left ?? 8,
        containLabel: true,
      },
      tooltip: hideTooltip
        ? { show: false }
        : tooltipOption(config, {
            background: colors.background,
            foreground: colors.foreground,
            border: colors.border,
          }),
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((row) => String(row[xKey] ?? "")),
        ...axisCommon(hideXAxis, fadedAxis),
      },
      yAxis: {
        type: "value",
        splitLine: { show: !hideGrid, lineStyle: { color: colors.grid, type: "dashed" } },
        ...axisCommon(hideYAxis, fadedAxis),
      },
      series: series.map((item) => {
        const color = colors[`series-${item.key}`] || colors.foreground
        const areaColor = colors.fill || color
        return {
          type: "line" as const,
          name: item.key,
          smooth,
          showSymbol: false,
          data: data.map((row) => row[item.key] as number),
          lineStyle: { width: strokeWidth, color },
          itemStyle: { color },
          emphasis: { focus: "series" as const, itemStyle: { color, borderWidth: 0 } },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(areaColor, 0.28) },
              { offset: 1, color: withAlpha(areaColor, 0.02) },
            ]),
          },
        }
      }),
    }),
    [
      colors,
      config,
      data,
      fadedAxis,
      grid,
      hideGrid,
      hideTooltip,
      hideXAxis,
      hideYAxis,
      series,
      smooth,
      strokeWidth,
      xKey,
    ]
  )

  return <BaseChart option={option} className={className} />
}

interface BarChartProps extends PresetChartProps {
  /** Corner radius on each bar (or segment, when stacked). */
  radius?: number
  maxBarWidth?: number
  /** Gap between category groups, as an ECharts percentage string. */
  categoryGap?: string
  /** Outline colour between stacked segments — usually the card background. */
  segmentBorderColor?: string
}

/** Vertical bars, stacked when series share a `stackId`. */
function BarChart({
  data,
  xKey,
  series,
  className,
  grid,
  axisColor = "var(--chart-axis)",
  axisOpacity,
  gridColor = "var(--chart-grid)",
  radius = 10,
  maxBarWidth = 38,
  categoryGap = "28%",
  segmentBorderColor,
  hideXAxis,
  hideYAxis,
  hideGrid,
  hideTooltip,
}: BarChartProps) {
  const { config } = useChart()

  const tokens = React.useMemo(() => {
    const map: Record<string, string | undefined> = {
      axis: axisColor,
      grid: gridColor,
      segmentBorder: segmentBorderColor,
      background: "var(--background)",
      foreground: "var(--foreground)",
      border: "var(--border)",
    }
    series.forEach((item) => {
      map[`series-${item.key}`] = seriesColorToken(item, config)
      item.colors?.forEach((color, index) => {
        map[`series-${item.key}-${index}`] = color
      })
    })
    return map
  }, [axisColor, config, gridColor, segmentBorderColor, series])

  const colors = useResolvedColors(tokens)
  const fadedAxis = axisOpacity ? withAlpha(colors.axis, axisOpacity) : colors.axis

  const option = React.useMemo<EChartsOption>(
    () => ({
      animationDuration: 400,
      grid: {
        top: grid?.top ?? 24,
        right: grid?.right ?? 8,
        bottom: grid?.bottom ?? 4,
        left: grid?.left ?? 8,
        containLabel: true,
      },
      tooltip: hideTooltip
        ? { show: false }
        : tooltipOption(
            config,
            {
              background: colors.background,
              foreground: colors.foreground,
              border: colors.border,
            },
            { axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.04)" } } }
          ),
      xAxis: {
        type: "category",
        data: data.map((row) => String(row[xKey] ?? "")),
        ...axisCommon(hideXAxis, fadedAxis),
      },
      yAxis: {
        type: "value",
        splitLine: { show: !hideGrid, lineStyle: { color: colors.grid, type: "dashed" } },
        ...axisCommon(hideYAxis, fadedAxis),
      },
      series: series.map((item) => {
        const base = colors[`series-${item.key}`] || colors.foreground
        return {
          type: "bar" as const,
          name: item.key,
          stack: item.stackId,
          barMaxWidth: maxBarWidth,
          barCategoryGap: categoryGap,
          itemStyle: {
            color: base,
            borderRadius: radius,
            ...(colors.segmentBorder
              ? { borderColor: colors.segmentBorder, borderWidth: 2 }
              : {}),
          },
          data: data.map((row, index) => {
            // A per-category colour turns one bar into the highlighted peak.
            const override = item.colors ? colors[`series-${item.key}-${index}`] : undefined
            return override
              ? { value: row[item.key] as number, itemStyle: { color: override } }
              : (row[item.key] as number)
          }),
        }
      }),
    }),
    [
      categoryGap,
      colors,
      config,
      data,
      fadedAxis,
      grid,
      hideGrid,
      hideTooltip,
      hideXAxis,
      hideYAxis,
      maxBarWidth,
      radius,
      series,
      xKey,
    ]
  )

  return <BaseChart option={option} className={className} />
}

/**
 * Applies an alpha to a resolved colour.
 *
 * The tokens are oklch, which takes a `/ <alpha>` component; anything else falls
 * back to `color-mix`, which every browser we target supports.
 */
function withAlpha(color: string, alpha: number): string {
  const trimmed = color.trim()
  if (/^oklch\([^/]+\)$/i.test(trimmed)) {
    return trimmed.replace(/\)$/, ` / ${alpha})`)
  }
  return `color-mix(in oklch, ${trimmed} ${Math.round(alpha * 100)}%, transparent)`
}

/* -------------------------------------------------------------------------- */
/*  Legend                                                                     */
/* -------------------------------------------------------------------------- */

type ChartLegendContentProps = {
  payload?: { value?: string; dataKey?: string; color?: string; type?: string }[]
  verticalAlign?: "top" | "bottom"
  hideIcon?: boolean
  nameKey?: string
  className?: string
} & React.ComponentProps<"div">

function ChartLegendContent({
  className,
  hideIcon = false,
  payload = [],
  verticalAlign = "bottom",
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey || item.dataKey || item.value || "value"}`
          const itemConfig = config[key]

          return (
            <div
              key={item.value}
              className="[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
    </div>
  )
}

/**
 * Legend built straight from a ChartConfig — the common case now that series are
 * described by config rather than by Recharts children.
 */
function ChartLegend({
  keys,
  className,
  verticalAlign = "bottom",
}: {
  keys: string[]
  className?: string
  verticalAlign?: "top" | "bottom"
}) {
  const { config } = useChart()

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {keys.map((key) => {
        const itemConfig = config[key]
        if (!itemConfig) return null
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: (itemConfig as { color?: string }).color }}
            />
            {itemConfig.label}
          </span>
        )
      })}
    </div>
  )
}

// BaseChart and resolveOptionColorTokens are exported inline above.
export {
  AreaChart,
  BarChart,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
}
