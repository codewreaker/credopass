/**
 * useToolbarContext – register page-level toolbar configuration.
 *
 * Call once per page component. The hook sets the toolbar context on mount
 * and resets it on unmount. It uses a ref to keep the latest config
 * without re-running the effect (advanced-event-handler-refs pattern).
 *
 * Usage:
 *   useToolbarContext({
 *     action: { icon: CalendarPlus, label: 'Create Event', onClick: handleCreate },
 *     search: { enabled: true, placeholder: 'Search events…' },
 *   });
 */
import { useEffect, useRef } from 'react';
import { useToolbarStore, type ToolbarContext } from '@credopass/lib/stores';

export function useToolbarContext(config: Partial<ToolbarContext>) {
  const setContext = useToolbarStore((s) => s.setContext);
  const resetContext = useToolbarStore((s) => s.resetContext);
  const searchQuery = useToolbarStore((s) => s.searchQuery);

  // Store latest config in a ref so the effect closure never goes stale
  // but we don't re-run the effect on every render either.
  const configRef = useRef(config);
  configRef.current = config;

  // On mount: push context. On unmount: reset.
  useEffect(() => {
    setContext(configRef.current);
    return () => {
      resetContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContext, resetContext]);

  useEffect(()=>{
    configRef.current.search?.onSearch?.(searchQuery);
  },[searchQuery])

  // Expose an imperative update for cases where the page needs to
  // change the toolbar config after mount (e.g., after data loads).
  return { updateContext: setContext };
}