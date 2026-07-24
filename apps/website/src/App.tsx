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

/** Client-side navigation: push the URL and notify subscribers, then scroll up. */
export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export default function App() {
  const pathname = usePathname();

  return (
    <ThemeProvider defaultTheme="dark">
      {pathname === '/how-it-works' ? <HowItWorks /> : <Home />}
    </ThemeProvider>
  );
}
