# UI Refactoring Project: Base UI Migration While Preserving Design

## PROJECT OBJECTIVE
Refactor the entire React/TypeScript application to use Base UI components instead of custom CSS-based components, while maintaining the exact current visual design, color scheme, typography, spacing, and overall aesthetic. The goal is to reduce CSS boilerplate and leverage Base UI's unstyled, accessible components.

---

## CRITICAL REQUIREMENTS

### 1. DESIGN PRESERVATION (NON-NEGOTIABLE)
Your primary goal is to ensure the application looks **IDENTICAL** to the current design after refactoring.

**Current Design Specifications:**
- **Color Palette:**
  - Primary Accent: Neon Lime (#d4ff00) - used for highlights, active states, brand elements
  - Secondary Accent: Lighter Lime (#e8ff66)
  - Dark Background: #1a1a1a (primary)
  - Darker Background: #0f0f0f (secondary)
  - Card Background: #252525
  - Text Primary: #ffffff
  - Text Secondary: #a0a0a0
  - Border Color: #333333
  - Success: #00ff88 (green)
  - Error: #ff4444 (red)

- **Typography:**
  - h1: 1.5rem, 700 weight
  - h2: 1.125rem, 600 weight
  - h3: 0.9375rem, 600 weight
  - h4: 0.75rem, 600 weight
  - p/body: 0.7125rem, line-height 1.6
  - Font Family: System stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', etc.)

- **Spacing System:**
  - Base unit: 0.375rem (6px)
  - Common increments: 0.375rem, 0.5rem, 0.75rem, 0.9375rem, 1.125rem, 1.5rem, 2rem, 2.25rem
  - Gap sizes: 0.375rem (tight), 0.75rem (normal), 2.25rem (large)

- **Border & Radius:**
  - Primary border radius: 6px
  - Alternative radiuses: 7.5px, 12px
  - Border style: 1px solid #333333
  - Hover transitions: 0.2s ease

- **Current Dark Theme Aesthetic:**
  - High-contrast dark mode with neon lime accents
  - Minimal, modern, tech-forward design
  - Three-column layout: TopNavBar (52.5px fixed) + LeftSidebar (collapsible 180px→52.5px) + MainContent + RightSidebar (collapsible 300px→30px)
  - Smooth collapse/expand animations with transitions

---

### 2. COMPONENT MIGRATION SCOPE

**Priority 1 (Replace Immediately):**
1. **Modal System** (src/components/Modal/)
   - Current: React Portal + custom CSS
   - Target: Base UI Modal component
   - Requirements:
     - Maintain fadeIn/slideUp animations
     - Keep overlay backdrop styling
     - Preserve close button (X icon)
     - Maintain loading spinner visual
     - Keep the type-safe modal hook system (useModal)

2. **Tooltip Component** (src/components/Tooltip/)
   - Current: Custom CSS positioning with auto-adjust
   - Target: Base UI Popper + Tooltip components
   - Requirements:
     - Maintain 4 position variants (top, bottom, left, right)
     - Keep auto-adjustment to prevent off-screen rendering
     - Preserve arrow styling pointing to target element
     - Maintain 200ms delay default behavior

3. **Button Elements** (throughout all components)
   - Current: Custom HTML buttons with CSS styling
   - Target: Base UI Button component
   - Requirements:
     - Maintain all current button variants (primary, secondary, icon-only)
     - Keep table-selector buttons with active state styling
     - Preserve refresh/action buttons in GridTable
     - Keep sign-in form buttons
     - Maintain hover, active, disabled states
     - Keep all icon integrations (lucide-react)

4. **Dropdown/Menu System** (TopNavBar dropdown, Modal dropdowns)
   - Current: Custom HTML select/div with CSS
   - Target: Base UI Menu/Select components
   - Requirements:
     - Preserve dropdown styling and positioning
     - Maintain all current functionality
     - Keep icon spacing and layouts
     - Preserve animation on open/close

5. **Form Input Components** (SignInModal, EventForm, etc.)
   - Current: Custom HTML input/select with CSS
   - Target: Base UI Input/Select components
   - Requirements:
     - Maintain form group layouts
     - Keep input icon overlays
     - Preserve focus/error states
     - Keep all form validation styling

**Priority 2 (Replace if beneficial):**
6. **Tabs Component** (if used in any pages)
   - Target: Base UI Tabs if found in codebase

7. **Badge/Status Indicators** (GridTable status/membership badges)
   - Target: Base UI Badge or styled divs maintaining current appearance

**Priority 3 (Keep As-Is):**
- **GridTable Component**: Keep AG Grid integration as-is (separate data grid library)
- **FullCalendar**: Keep calendar widget as-is
- **Recharts**: Keep charting library as-is
- **React Grid Layout**: Keep as-is for dashboard grid functionality

---

### 3. STYLING APPROACH WITH BASE UI

**Key Principle:** Base UI provides unstyled, headless components. You must apply styling to maintain the current design.

**Strategy:**
1. **Maintain CSS Variables** in src/index.css for the color palette and design tokens
2. **Create Base UI wrapper/styled components** in each component directory
3. **Apply className and style props** to Base UI components to match current aesthetics
4. **Consider these two approaches (choose best fit):**
   - **Option A**: Use Base UI's built-in styling capabilities + inline styles + CSS classes
   - **Option B**: Create styled-components or CSS modules wrapping Base UI components
   - **Recommendation**: Use a combination - Base UI components with scoped CSS per component and global CSS variables

**CSS Handling:**
- ✅ Keep: src/index.css (global variables and layout styles)
- ✅ Keep: Component-level style.css files ONLY if they contain unique styling
- ❌ Remove: CSS that exactly duplicates Base UI component styling
- ❌ Convert: Custom form input styling → Base UI Input styling with custom classes

**Example Pattern:**
```tsx
import { Button as BaseButton, ButtonProps } from '@base-ui-components/react/button';

export function Button({ className, ...props }: ButtonProps) {
  return (
    <BaseButton 
      className={`custom-button ${className || ''}`}
      {...props}
    />
  );
}
```

Then in component CSS:
```css
.custom-button {
  background-color: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.custom-button:hover {
  background-color: var(--primary-yellow);
  color: var(--dark-bg);
}
```

---

### 4. FILES TO REFACTOR (PRIORITY ORDER)

**PHASE 1 - Core Components:**
1. `src/components/Modal/ModalPortal.tsx` → Base UI Modal
   - Update useModal hook to work with Base UI
   - Preserve modal registry and type-safety

2. `src/components/Tooltip/index.tsx` → Base UI Popper + Tooltip
   - Create wrapper maintaining position auto-adjustment logic

3. All button usages across:
   - `src/containers/TopNavBar/index.tsx`
   - `src/containers/LeftSidebar/index.tsx`
   - `src/components/GridTable/Header.tsx`
   - `src/containers/SignInModal/index.tsx`
   - `src/components/EventForm/index.tsx`
   - `src/Pages/*/index.tsx` files

**PHASE 2 - Container Components:**
4. `src/containers/TopNavBar/index.tsx`
   - Replace dropdown with Base UI Menu
   - Keep search input styling
   - Maintain notification bell and user avatar interactions

5. `src/containers/SignInModal/index.tsx`
   - Replace form inputs with Base UI Input
   - Update form styling
   - Keep modal animations and backdrop

6. `src/components/EventForm/index.tsx`
   - Replace all inputs with Base UI Input/Select
   - Maintain form group structure
   - Keep validation styling

**PHASE 3 - Page Components:**
7. `src/Pages/Tables/index.tsx` (Database Admin page)
   - Replace table selector buttons with Base UI Button
   - Keep GridTable as-is

8. Other page components
   - Replace any custom buttons/dropdowns

---

### 5. SPECIFIC COMPONENT REQUIREMENTS

#### **Modal System Migration**
**Current Implementation:**
- React Portal rendering to document.body
- Custom overlay with fadeIn/slideUp animations
- Type-safe registration system (useModal, ModalRegistry)
- Loading spinner and close button
- Modal centered on screen with backdrop

**Base UI Requirements:**
- Migrate to Base UI Modal component
- Preserve all custom hook functionality (useModal, ModalRegistry)
- Keep animations by applying custom className/styles to Base UI Modal
- Maintain modal stacking (z-index handling)
- Preserve accessibility features
- Keep all modal instances (SignInModal, EventForm in modal, etc.)

**Migration Checklist:**
- [ ] Replace `ModalPortal.tsx` implementation with Base UI Modal
- [ ] Update `useModal.ts` hook to integrate with Base UI
- [ ] Verify all modals open/close correctly
- [ ] Test animation smoothness
- [ ] Ensure backdrop click closes modal
- [ ] Maintain scroll behavior when modal opens

#### **Tooltip Migration**
**Current Implementation:**
- Custom positioning with auto-adjustment
- Arrow pointing to target
- 4-position variants
- 200ms delay before showing

**Base UI Requirements:**
- Use Base UI Popper for positioning with arrow
- Use Base UI Tooltip for interaction handling
- Preserve auto-adjustment logic (create wrapper if needed)
- Maintain visual styling (arrow color, background)
- Keep delay behavior
- Ensure proper z-index stacking

#### **Button System Migration**
**Current Buttons Found:**
- Table selector buttons (with active state and count badge)
- GridTable action buttons (refresh, etc.)
- SignIn form buttons (submit, forgot password)
- TopNavBar buttons (new event, notifications)
- Modal close buttons (X icon)
- Form submit buttons

**Base UI Button Requirements:**
- Replace all with Base UI Button component
- Preserve visual states: default, hover, active, disabled
- Maintain size variants (small icon buttons, normal buttons)
- Keep icon integrations (lucide-react)
- Preserve onClick handlers and functionality
- Update styling to maintain current appearance

#### **Form Input Migration**
**Current Form Usage:**
- SignInModal: email, password inputs
- EventForm: multiple input types (text, date, time, select, etc.)
- TopNavBar: search input

**Base UI Requirements:**
- Replace with Base UI Input components
- Replace selects with Base UI Select
- Maintain input icon overlays
- Keep placeholder text styling
- Preserve focus/error states
- Keep form validation messaging
- Maintain label structure

#### **Dropdown/Menu Migration**
**Current Usage:**
- TopNavBar user avatar dropdown menu
- Any modal select dropdowns

**Base UI Requirements:**
- Use Base UI Menu component for dropdowns
- Use Base UI Select for form selects
- Preserve positioning and animation
- Keep keyboard navigation
- Maintain styling and hover states

---

### 6. INSTALLATION & SETUP

```bash
npm install @base-ui-components/react
# or
bun install @base-ui-components/react
```

**Verify Installation:**
- Check that @base-ui-components/react is added to package.json
- Ensure no conflicts with existing dependencies

**Build Configuration:**
- Review vite.config.ts code splitting (may need update for new Base UI vendor chunk)
- Verify React compiler plugin compatibility

---

### 7. MIGRATION WORKFLOW

**For Each Component Refactoring:**

1. **Analyze Current Implementation**
   - Document current CSS styling
   - Identify all Base UI components needed
   - Note any custom behavior/animations

2. **Create Styled Wrapper (if needed)**
   - Wrap Base UI component
   - Apply custom className and styles
   - Export for use in parent components

3. **Update Parent Component**
   - Import styled Base UI component
   - Replace old HTML/custom implementation
   - Verify all props still work
   - Update any import statements

4. **Test Visually**
   - Ensure appearance matches original
   - Test all interaction states (hover, active, disabled, focus)
   - Verify animations/transitions
   - Test responsive behavior
   - Check keyboard accessibility

5. **Cleanup**
   - Remove unused CSS rules from component CSS files
   - Remove unused imports
   - Keep CSS variables in place

---

### 8. PRESERVED FUNCTIONALITY CHECKLIST

Ensure these features/behaviors are NOT lost during refactoring:

**State Management:**
- [ ] Zustand store integration (useAppStore)
- [ ] useModal hook functionality
- [ ] Sidebar collapse/expand state
- [ ] All event handlers and callbacks

**Accessibility:**
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] ARIA attributes maintained/enhanced
- [ ] Focus management
- [ ] Screen reader compatibility

**Animations & Transitions:**
- [ ] Modal fadeIn/slideUp animations
- [ ] Sidebar collapse smooth transition
- [ ] Hover state transitions (0.2s ease)
- [ ] Dropdown open/close animations

**Responsive Behavior:**
- [ ] Sidebar collapse on mobile
- [ ] Right sidebar minimize
- [ ] Grid table responsiveness
- [ ] Modal responsive sizing

**Data & Interactions:**
- [ ] Table data fetching and refresh
- [ ] Form submission and validation
- [ ] Dropdown menu item selection
- [ ] Modal open/close functionality
- [ ] All button click handlers

---

### 9. BASE UI DOCUMENTATION REFERENCE

Use this as your primary reference:
- **Quick Start**: https://base-ui.com/react/overview/quick-start
- **Components**: https://base-ui.com/react/components
- **Examples**: Check component-specific docs for styling patterns

**Key Base UI Components You'll Need:**
- Modal: https://base-ui.com/react/components/modal
- Popper: https://base-ui.com/react/components/popper (for positioning)
- Menu: https://base-ui.com/react/components/menu
- Button: Base UI may provide or you may need to use HTML button with styling
- Input/Form: Check docs for form-related components
- Select: https://base-ui.com/react/components/select
- Tooltip: Check if directly available or use Popper

**Important Base UI Concepts:**
- Unstyled/headless approach (you must provide styling)
- Slot-based customization
- Built-in accessibility (ARIA, keyboard nav)
- Render props pattern (check if applicable)
- Prop spreading and composition

---

### 10. TESTING & VALIDATION

**After Each Component:**
1. Visual regression testing - does it look identical?
2. Functional testing - do all interactions work?
3. Accessibility testing - keyboard nav, screen reader
4. Browser testing - Firefox, Chrome, Safari

**Final Validation Checklist:**
- [ ] All pages load without errors
- [ ] All modals open/close correctly
- [ ] All form inputs work (type, submit, validation)
- [ ] All buttons respond to clicks
- [ ] All tooltips display and position correctly
- [ ] Sidebar collapse/expand works
- [ ] Table refresh and data display works
- [ ] Calendar widget functions
- [ ] Charts display correctly
- [ ] No console errors or warnings
- [ ] Visual design matches original (colors, spacing, typography)
- [ ] Animations are smooth
- [ ] Responsive behavior works

---

### 11. FINAL DELIVERABLES

After completing all refactoring:

1. **Updated Component Files:** All components using Base UI instead of custom HTML + CSS
2. **Updated Style Files:** Only necessary CSS remains (CSS variables, layout, and Base UI styling)
3. **Updated package.json:** Shows @base-ui-components/react dependency
4. **No Broken Functionality:** All features work identically to before
5. **Identical Visual Design:** Every pixel looks the same as the original
6. **Reduced CSS:** Significant reduction in custom CSS boilerplate

---

### 12. ADDITIONAL CONTEXT

**Project Structure:**
- Root config files: drizzle.config.ts, eslint.config.js, vite.config.ts, tsconfig.json
- Server: /server directory with API routes
- Source: /src with pages, components, containers, entities, lib
- Data: /data directory for static data
- Public: /public for static assets

**Current Key Files to Review:**
- `src/index.css` - Global styles and CSS variables (KEEP and REFERENCE)
- `src/App.tsx` - (if exists) root app component
- `src/store.ts` - Zustand store setup
- `src/routes.tsx` - Route definitions
- Component CSS files - Review for styling to preserve

**Dependencies to Be Aware Of:**
- **AG Grid**: Keep as-is (separate data grid library)
- **Zustand**: State management, no changes needed
- **React Router**: Routing, no changes needed
- **React Query**: Data fetching, no changes needed
- **Lucide React**: Icon library, maintain usage
- **Recharts**: Charting, keep as-is
- **FullCalendar**: Calendar widget, keep as-is
- **React Grid Layout**: Dashboard layout, keep as-is

**Critical Success Metrics:**
1. ✅ Visual design is 100% identical to original
2. ✅ All functionality works without errors
3. ✅ Base UI components replace custom CSS components
4. ✅ CSS file sizes reduced
5. ✅ No breaking changes to component APIs
6. ✅ Improved maintainability and reduced CSS boilerplate

---

### 13. HANDLING EDGE CASES

**AG Grid Integration:**
- Keep AG Grid exactly as-is
- Its CSS is separate and doesn't need Base UI conversion
- Only convert UI elements surrounding the grid (buttons, headers, etc.)

**Complex Form (EventForm):**
- Break down into smaller, manageable refactoring steps
- Ensure all field types (text, select, date, time, etc.) work with Base UI inputs
- Maintain form validation and error messaging

**Dynamic Column Generation (GridTable):**
- Keep AG Grid column logic as-is
- Only replace surrounding UI elements

**Custom Hooks:**
- `useModal` - Update to work with Base UI Modal but maintain same API
- `useAppStore` - No changes needed
- Other custom hooks - No changes needed unless they render UI

---

### 14. QUESTIONS TO GUIDE IMPLEMENTATION

Before implementing each component, ask:

1. **What does Base UI provide?** (Check docs)
2. **What custom styling do I need to add?** (CSS or inline)
3. **What functionality must be preserved?** (Handlers, state, etc.)
4. **How do I maintain the current design?** (Colors, spacing, animations)
5. **Are there any accessibility improvements?** (Base UI provides built-in a11y)
6. **What can I remove from the CSS file?** (What's now handled by Base UI)

---

## SUMMARY

You are refactoring a modern React dashboard application to use Base UI components while preserving its distinctive dark theme with neon lime accents. The goal is to reduce custom CSS, improve component maintainability, and leverage Base UI's accessibility features—all while maintaining pixel-perfect visual consistency with the current design.

The codebase has a clean architecture with modular components, a type-safe modal system, and clear separation of concerns. Base UI migration should be straightforward since there's no competing component library, and you can leverage the existing CSS variables for styling Base UI components.

Start with Priority 1 components (Modal, Tooltip, Buttons), then move through containers and pages. After completion, the application should look and function identically to before, but with cleaner, more maintainable code.

**Good luck!**
