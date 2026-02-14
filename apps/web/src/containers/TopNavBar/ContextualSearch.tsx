import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useToolbarStore } from '../../stores/toolbar-store';
import { cn } from '@credopass/ui/lib/utils';

const DEBOUNCE_MS = 250;

/**
 * ContextualSearch – inline search input that lives in the top toolbar.
 *
 * Collapsed state: a search icon button.
 * Expanded state : an input with the page-specific placeholder.
 *
 * The typed value is debounced before being pushed into the toolbar store,
 * so pages only re-render when the debounced query actually changes.
 *
 * Follows:
 *  - client-event-listeners: single listener, stable ref
 *  - rerender-use-ref-transient-values: raw keystrokes stored in ref
 *  - rerender-defer-reads: debounced value goes to store, not every keystroke
 */
const ContextualSearch: React.FC = () => {
  const searchEnabled = useToolbarStore((s) => s.search.enabled);
  const placeholder = useToolbarStore((s) => s.search.placeholder);
  const searchVisible = useToolbarStore((s) => s.searchVisible);
  const showSearch = useToolbarStore((s) => s.showSearch);
  const hideSearch = useToolbarStore((s) => s.hideSearch);
  const setSearchQuery = useToolbarStore((s) => s.setSearchQuery);

  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when expanded
  useEffect(() => {
    if (searchVisible) {
      // Small delay to let the CSS transition start before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    // Clear local state when collapsing
    setLocalValue('');
  }, [searchVisible]);

  // Debounce handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(val);
      }, DEBOUNCE_MS);
    },
    [setSearchQuery],
  );

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Keyboard: Escape collapses
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideSearch();
      }
    },
    [hideSearch],
  );

  // Blur handler: collapse if empty
  const handleBlur = useCallback(() => {
    if (!localValue.trim()) {
      hideSearch();
    }
  }, [localValue, hideSearch]);

  if (!searchEnabled) return null;

  return (
    <div className={cn('toolbar-search-wrapper', searchVisible && 'toolbar-search-expanded')}>
      {searchVisible ? (
        <>
          <Search className="toolbar-search-input-icon" size={14} />
          <input
            ref={inputRef}
            type="text"
            className="toolbar-search-input"
            placeholder={placeholder}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            aria-label={placeholder}
          />
          <button
            type="button"
            className="toolbar-search-clear"
            onClick={hideSearch}
            aria-label="Close search"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <button
          type="button"
          className="toolbar-search-toggle"
          onClick={showSearch}
          aria-label="Open search"
        >
          <Search size={16} />
        </button>
      )}
    </div>
  );
};

export default ContextualSearch;
