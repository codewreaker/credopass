import { useEffect, useState } from 'react';

export interface VisualViewportState {
  /**
   * Height in px of the area at the bottom of the layout viewport that is
   * covered by on-screen UI — in practice, the software keyboard. `0` when
   * nothing is covering it (or when the browser has no visualViewport API).
   */
  keyboardInset: number;
  /** Height of the *visible* area, i.e. window height minus the keyboard. */
  viewportHeight: number;
}

/**
 * Tracks the visual viewport so popups can stay pinned above the on-screen
 * keyboard on mobile.
 *
 * `100dvh` only accounts for browser chrome, not the keyboard: when the
 * keyboard slides up, the layout viewport is unchanged and a bottom-anchored
 * dialog ends up underneath it. `window.visualViewport` is the only thing that
 * reports the real visible box, so we mirror it into React state and let
 * callers turn it into a CSS custom property.
 */
export function useVisualViewport(enabled = true): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    keyboardInset: 0,
    viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
  });

  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!enabled || !vv) return;

    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // offsetTop covers the case where the page is scrolled under the
        // keyboard; without it the inset is overstated on iOS.
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setState({
          // Sub-pixel jitter from the keyboard animation would thrash renders.
          keyboardInset: inset < 1 ? 0 : Math.round(inset),
          viewportHeight: Math.round(vv.height),
        });
      });
    };

    read();
    vv.addEventListener('resize', read);
    vv.addEventListener('scroll', read);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', read);
      vv.removeEventListener('scroll', read);
    };
  }, [enabled]);

  return state;
}
