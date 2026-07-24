# `@credopass/ui`

> The web design system. Themeable React components built on [Base UI](https://base-ui.com), styled with Tailwind v4, shared by the app and the marketing site.

**Depends on:** `@base-ui/react`, `class-variance-authority`, `tailwind-merge`, plus specialised libs (below).
**Consumed by:** `apps/web`, `apps/website`.

---

## What's in the box

**Primitives** — `button`, `input`, `card`, `badge`, `label`, `checkbox`, `select`, `combobox`, `popover`, `tooltip`, `separator`, `avatar`, `spinner`, `kbd`, `tabs`, `alert`, `field`, `item`, `empty`.

**Composites** — `sidebar`, `bottom-nav`, `command` (⌘K palette via `cmdk`), `sheet` + `sheet-dialog`, `dialog` + `alert-dialog`, `timeline`, `chip-filter`, `button-group`, `input-group`, `expanding-search-dock`, `upgrade-cta`, `logo-cloud`, `decor-mask`.

**Data-heavy / specialised**
| Component | Backed by |
|-----------|-----------|
| `chart` | `echarts` (+ `recharts` interop) |
| `map` | `maplibre-gl` |
| `address-autofill` | `@mapbox/search-js` |
| `calendar` / `date-time-range-picker` | `react-day-picker`, `date-fns` |
| `sonner` | toast notifications |
| QR display | `qrcode.react` |

Animations use `motion`. `lib/utils.ts` exports the `cn()` class-merge helper.

## Design language

The house style (approved during the 2026 UI rebuild):

- **Lime billboard heroes** — big, high-contrast primary (`--primary` is lime) hero blocks.
- **Pill controls** — rounded, compact segmented controls and filter chips.
- **Sharp, borderless list cards** — dense list rows, minimal chrome.

Tokens live in `src/styles/globals.css` (CSS variables, light + dark). Always reference `bg-primary`, `text-muted-foreground`, `border-border/60` etc. rather than hard-coding colours.

## Two conventions that will trip you up

**1. Base UI uses the render-prop pattern, not `asChild`.** Spread the provided props:

```tsx
<Menu.Item render={(props) => <a {...props} href="/x">Go</a>} />
```

**2. Forms are pages, not dialogs.** Anything with a keyboard (a create/edit form) is a full page or a `SheetDialog`. Reserve plain `Dialog` for granular single-value edits. Composer helpers accept a `closeLauncher` callback.

## Usage

```tsx
import { Button } from '@credopass/ui/components/button';
import { cn } from '@credopass/ui/lib/utils';
```

> Mobile has a **separate** design system — see `@credopass/ui-mobile`. This package is web-only (DOM + Tailwind).
