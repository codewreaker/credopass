import { useSyncExternalStore } from 'react';
import { ThemeProvider } from '@credopass/lib/theme';
import { Home } from './pages/Home';
import { HowItWorks } from './pages/HowItWorks';

/**
 * Dependency-free path router. The marketing site is a handful of pages, so we
 * lean on the History API rather than pulling in a router. Vercel already
 * rewrites every path to index.html (see vercel.json), so deep links resolve.
 */
function usePathname() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    () => window.location.pathname,
    () => '/'
  );
}

/**
 * Client-side navigation. Optionally scrolls to an element id once the target
 * route has rendered — used for persona deep-links from the home page.
 *
 * - Same page + `elementId`  → smooth-scroll to that section.
 * - Different page           → push the route, then scroll (to the element, or top).
 */
export function navigate(to: string, elementId?: string) {
  const samePage = to === window.location.pathname;

  if (!samePage) {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  const scrollToTarget = (attempt = 0) => {
    if (!elementId) {
      window.scrollTo({ top: 0, behavior: samePage ? 'smooth' : 'auto' });
      return;
    }
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (attempt < 5) {
      // The destination route may not have mounted yet — retry a few frames.
      requestAnimationFrame(() => scrollToTarget(attempt + 1));
    }
  };

  requestAnimationFrame(() => scrollToTarget());
}

export default function App() {
  const pathname = usePathname();

  return (
    <ThemeProvider defaultTheme="dark">
      {pathname === '/how-it-works' ? <HowItWorks /> : <Home />}
    </ThemeProvider>
  );
}
