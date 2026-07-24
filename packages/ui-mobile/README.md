# `@credopass/ui-mobile`

> The React Native design system. The mobile counterpart to `@credopass/ui` — same visual language, native primitives.

**Consumed by:** `apps/mobile`.
**Why separate from `@credopass/ui`:** that package is DOM + Tailwind; this one is React Native `View`/`Text`/`StyleSheet`. They intentionally don't share component code, only design intent.

---

## Components

`Button` · `Card` · `Input` · `Select` · `Avatar` · `Badge` · `Loader` · `EmptyState` · `QRDisplay` · `EventRow` · `EventCalendar` · `DataTable`

Each lives in `src/components/<Name>/index.tsx` and is re-exported from `src/components/index.ts`.

## Theme

`src/theme/` is the design-token source for mobile:

| File | Contains |
|------|----------|
| `colors.ts` | Palette (mirrors the web lime/dark language) |
| `typography.ts` | Font sizes, weights, line heights |
| `spacing.ts` | Spacing scale |
| `index.ts` | Barrel export |

## Usage

```tsx
import { Button, EventRow, QRDisplay } from '@credopass/ui-mobile/components';
import { colors, spacing } from '@credopass/ui-mobile/theme';
```

Keep this package and `@credopass/ui` **visually** in sync (colours, spacing, radii) even though the implementations differ.
