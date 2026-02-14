import React, { useCallback, useEffect, useRef } from 'react';
import { useToolbarStore } from '../../stores/toolbar-store';
import { ExpandingSearchDock } from '@credopass/ui/components/expanding-search-dock';

const DEBOUNCE_MS = 50; //because its local-first, increase for server requests

/**
 * ContextualSearch – inline search input that lives in the top toolbar.
 *
 * Uses the ExpandingSearchDock UI component from @credopass/ui and wires it
 * into the toolbar store with debounced search propagation.
 *
 * Follows:
 *  - client-event-listeners: single listener, stable ref
 *  - rerender-use-ref-transient-values: raw keystrokes stored in ref
 *  - rerender-defer-reads: debounced value goes to store, not every keystroke
 */
const ContextualSearch: React.FC<{ className?: string }> = ({ className }) => {
  const searchEnabled = useToolbarStore((s) => s.search.enabled);
  const placeholder = useToolbarStore((s) => s.search.placeholder);
  const setSearchQuery = useToolbarStore((s) => s.setSearchQuery);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Debounced search handler
  const handleSearch = useCallback(
    (query: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(query);
      }, DEBOUNCE_MS);
    },
    [setSearchQuery],
  );

  if (!searchEnabled) return null;

  return (
    <ExpandingSearchDock
      className={className}
      onSearch={handleSearch}
      placeholder={placeholder}
    />
  );
};

export default ContextualSearch;
