import React, { useMemo, useCallback } from "react";
import {
  Responsive,
  useContainerWidth,
  verticalCompactor,
  horizontalCompactor,
  noCompactor,
  type Layout,
  type Compactor,
} from "react-grid-layout";

// ResponsiveLayouts type from react-grid-layout
export type ResponsiveLayouts<K extends string = string> = Partial<Record<K, Layout>>;

// Import required styles
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";


/**
 * Grid configuration interface
 */
export interface GridConfig {
  rowHeight?: number;
  margin?: [number, number];
  containerPadding?: [number, number] | null;
  maxRows?: number;
}

/**
 * Drag configuration interface
 */
export interface DragConfig {
  enabled?: boolean;
  bounded?: boolean;
  handle?: string;
  cancel?: string;
  threshold?: number;
}

/**
 * Resize configuration interface
 */
export interface ResizeConfig {
  enabled?: boolean;
  handles?: Array<"s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne">;
}

/**
 * Responsive breakpoints type
 */
export type Breakpoints = {
  lg: number;
  md: number;
  sm: number;
  xs: number;
  xxs: number;
};

/**
 * Column configuration per breakpoint
 */
export type Cols = {
  lg: number;
  md: number;
  sm: number;
  xs: number;
  xxs: number;
};

/**
 * Props for the ResponsiveGridLayout component
 */
export interface ResponsiveGridLayoutProps {
  children: React.ReactNode;
  layouts?: ResponsiveLayouts<string>;
  onLayoutChange?: (layout: Layout, allLayouts: ResponsiveLayouts<string>) => void;
  onBreakpointChange?: (breakpoint: string, cols: number) => void;
  className?: string;
  gridConfig?: GridConfig;
  dragConfig?: DragConfig;
  resizeConfig?: ResizeConfig;
  compactType?: "vertical" | "horizontal" | null;
  breakpoints?: Breakpoints;
  cols?: Cols;
  autoSize?: boolean;
  style?: React.CSSProperties;
  measureBeforeMount?: boolean;
  initialWidth?: number;
}

/**
 * Get compactor based on compact type
 */
function getCompactor(compactType: "vertical" | "horizontal" | null): Compactor {
  switch (compactType) {
    case "vertical":
      return verticalCompactor;
    case "horizontal":
      return horizontalCompactor;
    case null:
      return noCompactor;
    default:
      return verticalCompactor;
  }
}

/**
 * ResponsiveGridLayout - A wrapper around react-grid-layout's Responsive component
 * 
 * This component automatically adjusts the layout based on the container width
 * and defined breakpoints. It supports different layouts for each breakpoint.
 * 
 * Default Configuration:
 * - Grid: 30px rows, 10px margins, padding matches margin
 * - Drag: enabled with ".drag-handle" selector, 3px threshold
 * - Resize: enabled with south-east handle
 * - Breakpoints: lg(1200), md(996), sm(768), xs(480), xxs(0)
 * - Columns: lg(12), md(10), sm(6), xs(4), xxs(2)
 * 
 * @example
 * ```tsx
 * const layouts = {
 *   lg: [{ i: "a", x: 0, y: 0, w: 4, h: 4 }],
 *   md: [{ i: "a", x: 0, y: 0, w: 3, h: 4 }],
 * };
 * 
 * <ResponsiveGridLayout layouts={layouts}>
 *   <div key="a">
 *     <div className="drag-handle">⋮⋮</div>
 *     Item A
 *   </div>
 * </ResponsiveGridLayout>
 * ```
 */
const ResponsiveGridLayout: React.FC<ResponsiveGridLayoutProps> = ({
  children,
  layouts,
  onLayoutChange,
  onBreakpointChange,
  className = "",
  gridConfig = {},
  dragConfig = {},
  resizeConfig = {},
  compactType = "vertical",
  breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  autoSize = true,
  style,
  measureBeforeMount = false,
  initialWidth = 1280,
}) => {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount,
    initialWidth,
  });

  // Merge with smart defaults optimized for dashboard layouts
  const finalGridConfig = useMemo(
    () => ({
      rowHeight: 30,
      margin: [10, 10] as [number, number],
      containerPadding: [10, 10] as [number, number],
      maxRows: Infinity,
      ...gridConfig,
    }),
    [gridConfig]
  );

  // Merge with smart defaults - drag handle required, bounded by default
  const finalDragConfig = useMemo(
    () => ({
      enabled: true,
      bounded: false,
      handle: ".drag-handle",
      cancel: undefined,
      threshold: 3,
      ...dragConfig,
    }),
    [dragConfig]
  );

  // Merge with smart defaults - southeast handle only
  const finalResizeConfig = useMemo(
    () => ({
      enabled: true,
      handles: ["se"] as Array<"s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne">,
      ...resizeConfig,
    }),
    [resizeConfig]
  );

  // Get the compactor function
  const compactor = useMemo(() => getCompactor(compactType), [compactType]);

  const handleLayoutChange = useCallback(
    (layout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
      if (onLayoutChange) {
        onLayoutChange(layout, allLayouts);
      }
    },
    [onLayoutChange]
  );

  const handleBreakpointChange = useCallback(
    (breakpoint: string, cols: number) => {
      if (onBreakpointChange) {
        onBreakpointChange(breakpoint, cols);
      }
    },
    [onBreakpointChange]
  );

  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className={`grid-layout ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`grid-layout ${className}`}
      style={style}
    >
      <Responsive
        width={width}
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={finalGridConfig.rowHeight}
        margin={finalGridConfig.margin}
        containerPadding={finalGridConfig.containerPadding}
        maxRows={finalGridConfig.maxRows}
        dragConfig={{
          enabled: finalDragConfig.enabled,
          bounded: finalDragConfig.bounded,
          handle: finalDragConfig.handle,
          cancel: finalDragConfig.cancel,
          threshold: finalDragConfig.threshold,
        }}
        resizeConfig={{
          enabled: finalResizeConfig.enabled,
          handles: finalResizeConfig.handles,
        }}
        compactor={compactor}
        autoSize={autoSize}
      >
        {children}
      </Responsive>
    </div>
  );
};

// Re-export useful types
export type { Layout };

// Default export
export default ResponsiveGridLayout;
