# ResponsiveGridLayout

A streamlined wrapper around `react-grid-layout` v2 for responsive dashboard layouts.

## Features

- ✅ Built on react-grid-layout v2 with full TypeScript support
- ✅ Automatic width measurement via `useContainerWidth` hook
- ✅ Smart defaults optimized for dashboard layouts
- ✅ Responsive breakpoint handling out of the box

## Quick Start

```tsx
import { ResponsiveGridLayout } from "@/lib/grid-layout";

const layouts = {
  lg: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "chart-1", x: 6, y: 0, w: 6, h: 10, minW: 4, minH: 6 },
  ],
  md: [
    { i: "stat-1", x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: "chart-1", x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 6 },
  ],
};

<ResponsiveGridLayout layouts={layouts}>
  <div key="stat-1">
    <div className="drag-handle">⋮⋮</div>
    Stat Card
  </div>
  <div key="chart-1">
    <div className="drag-handle">⋮⋮</div>
    Chart
  </div>
</ResponsiveGridLayout>
```

## Default Configuration

The component comes with sensible defaults:

**Grid Configuration:**
- `rowHeight`: 30px
- `margin`: [10, 10]
- `containerPadding`: [10, 10]

**Drag Configuration:**
- `enabled`: true
- `handle`: ".drag-handle" (requires drag handle in children)
- `threshold`: 3px

**Resize Configuration:**
- `enabled`: true
- `handles`: ["se"] (south-east corner only)

**Breakpoints:**
- `lg`: 1200px (12 columns)
- `md`: 996px (10 columns)
- `sm`: 768px (6 columns)
- `xs`: 480px (4 columns)
- `xxs`: 0px (2 columns)

## Props

### Core Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `React.ReactNode` | **required** | Grid items with `key` matching layout `i` |
| `layouts` | `ResponsiveLayouts<string>` | - | Layouts per breakpoint |
| `onLayoutChange` | `(layout, allLayouts) => void` | - | Callback when layout changes |
| `onBreakpointChange` | `(breakpoint, cols) => void` | - | Callback when breakpoint changes |
| `className` | `string` | `""` | Additional CSS class |
| `style` | `React.CSSProperties` | - | Inline styles |

### Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gridConfig` | `GridConfig` | See defaults | Override grid settings |
| `dragConfig` | `DragConfig` | See defaults | Override drag settings |
| `resizeConfig` | `ResizeConfig` | See defaults | Override resize settings |
| `compactType` | `"vertical" \| "horizontal" \| null` | `"vertical"` | Compaction direction |
| `breakpoints` | `Breakpoints` | See defaults | Custom breakpoint values |
| `cols` | `Cols` | See defaults | Custom column counts |

## Usage Examples

### Minimal Setup (Using Defaults)

```tsx
<ResponsiveGridLayout layouts={layouts}>
  {children}
</ResponsiveGridLayout>
```

### Custom Container Padding

```tsx
<ResponsiveGridLayout 
  layouts={layouts}
  gridConfig={{ containerPadding: [0, 0] }}
>
  {children}
</ResponsiveGridLayout>
```

### Disable Dragging

```tsx
<ResponsiveGridLayout 
  layouts={layouts}
  dragConfig={{ enabled: false }}
>
  {children}
</ResponsiveGridLayout>
```

### Custom Drag Handle

```tsx
<ResponsiveGridLayout 
  layouts={layouts}
  dragConfig={{ handle: ".custom-handle" }}
>
  <div key="item-1">
    <div className="custom-handle">📌</div>
    Content
  </div>
</ResponsiveGridLayout>
```

### No Compaction (Free Positioning)

```tsx
<ResponsiveGridLayout 
  layouts={layouts}
  compactType={null}
>
  {children}
</ResponsiveGridLayout>
```

## Layout Item Structure

```typescript
interface LayoutItem {
  i: string;          // Unique ID (must match child key)
  x: number;          // X position (grid units)
  y: number;          // Y position (grid units)
  w: number;          // Width (grid units)
  h: number;          // Height (grid units)
  minW?: number;      // Minimum width
  maxW?: number;      // Maximum width
  minH?: number;      // Minimum height
  maxH?: number;      // Maximum height
  static?: boolean;   // Not draggable/resizable
}
```

## Best Practices

1. **Always use drag handles** to prevent accidental drags (default: `.drag-handle`)
2. **Memoize children** for better performance
3. **Set min/max dimensions** to prevent layout issues
4. **Persist layouts** to localStorage or backend via `onLayoutChange`

## Styling

The CSS is automatically imported. Add custom styles:

```css
.grid-layout {
  background: #1a1a1a;
}

.grid-item {
  background: #252525;
  border-radius: 8px;
}

.drag-handle {
  cursor: move;
  color: #666;
}
```

## TypeScript

Full type definitions are exported:

```typescript
import type { 
  Layout, 
  ResponsiveLayouts,
  GridConfig,
  DragConfig,
  ResizeConfig 
} from "@/lib/grid-layout";
```
