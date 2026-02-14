/**
 * Toolbar Context Store
 *
 * Zustand store that drives the context-aware toolbar.
 * Each page registers its toolbar configuration (secondary action + search)
 * on mount and cleans up on unmount via the `useToolbarContext` hook.
 *
 * Follows:
 *  - rerender-defer-reads: callbacks read latest state via getState()
 *  - rerender-derived-state: consumers subscribe to derived booleans
 *  - js-early-exit: guard clauses in setters
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { LucideIcon } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

export interface ToolbarAction {
  /** Lucide icon component for the button */
  icon: LucideIcon;
  /** Accessible label / tooltip */
  label: string;
  /** Fire-and-forget click handler */
  onClick: () => void;
}

export interface SearchConfig {
  /** Whether this page supports search */
  enabled: boolean;
  /** Placeholder text inside the input */
  placeholder: string;
}

export interface ToolbarContext {
  action: ToolbarAction | null;
  search: SearchConfig;
}

interface ToolbarState extends ToolbarContext {
  /** Live (debounced) search query pages subscribe to */
  searchQuery: string;
  /** Whether the inline search input is expanded */
  searchVisible: boolean;
}

interface ToolbarActions {
  /** Pages call this to register their toolbar context */
  setContext: (ctx: Partial<ToolbarContext>) => void;
  /** Reset context to defaults (called on page unmount) */
  resetContext: () => void;
  /** Update the debounced search query */
  setSearchQuery: (query: string) => void;
  /** Toggle search input visibility */
  toggleSearch: () => void;
  /** Show search input */
  showSearch: () => void;
  /** Hide search input and clear query */
  hideSearch: () => void;
}

// ── Defaults ───────────────────────────────────────────────────

const DEFAULT_SEARCH: SearchConfig = { enabled: false, placeholder: 'Search…' };

// ── Store ──────────────────────────────────────────────────────

export const useToolbarStore = create<ToolbarState & ToolbarActions>()(
  devtools(
    (set) => ({
      // State
      action: null,
      search: DEFAULT_SEARCH,
      searchQuery: '',
      searchVisible: false,

      // Actions
      setContext: (ctx) =>
        set({
          action: ctx.action !== undefined ? ctx.action : null,
          search: ctx.search !== undefined ? ctx.search : DEFAULT_SEARCH,
          // Reset search state on context change (page navigation)
          searchQuery: '',
          searchVisible: false,
        }),

      resetContext: () =>
        set({
          action: null,
          search: DEFAULT_SEARCH,
          searchQuery: '',
          searchVisible: false,
        }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleSearch: () =>
        set((s) => ({
          searchVisible: !s.searchVisible,
          // Clear query when collapsing
          ...(!s.searchVisible ? {} : { searchQuery: '' }),
        })),

      showSearch: () => set({ searchVisible: true }),

      hideSearch: () => set({ searchVisible: false, searchQuery: '' }),
    }),
    { name: 'ToolbarStore' },
  ),
);
