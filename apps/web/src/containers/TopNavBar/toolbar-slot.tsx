import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Toolbar action slot — lets a page render its own stateful buttons into the
 * top bar without pushing them through the toolbar store.
 *
 * The three events-page toggles (filter, shortcuts, calendar) carry live state
 * that lives in the page. Serialising them into zustand would capture stale
 * closures, so instead the TopNavBar registers a DOM node here and pages portal
 * their buttons into it — the buttons stay in the page's own render tree (live
 * state, correct handlers) while appearing up in the chrome.
 */

interface ToolbarSlotValue {
  node: HTMLElement | null;
  /** Ref callback the TopNavBar attaches to its slot element. */
  setNode: (el: HTMLElement | null) => void;
}

const ToolbarSlotContext = React.createContext<ToolbarSlotValue>({
  node: null,
  setNode: () => {},
});

/** Wraps the app shell so the top bar and the page content share one slot node. */
export function ToolbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ node, setNode }), [node]);
  return <ToolbarSlotContext.Provider value={value}>{children}</ToolbarSlotContext.Provider>;
}

/** Ref callback for the TopNavBar's slot element. */
export function useToolbarSlotRef() {
  return React.useContext(ToolbarSlotContext).setNode;
}

/**
 * Renders its children into the top-bar slot. No-op until the slot node exists,
 * so it's safe to mount before the shell has laid out.
 */
export function ToolbarActionsSlot({ children }: { children: React.ReactNode }) {
  const { node } = React.useContext(ToolbarSlotContext);
  if (!node) return null;
  return createPortal(children, node);
}
