import { Suspense } from "react";
import { createRootRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar/index";
import LeftSidebar, { SidebarInset, SidebarTrigger, OrgSelector } from "../containers/LeftSidebar";
import { RightSidebar } from "../containers/RightSidebar";

import "../Pages/layout.css";
import { useIsMobile } from "@credopass/ui/hooks/use-mobile";
import { Toaster } from "@credopass/ui/components/sonner";
import { Separator } from "@credopass/ui/components/separator";
import { ModalPortal } from "@credopass/ui/components/launcher";
import { NAV_ITEMS } from "@credopass/lib/constants";
import { useTheme } from "@credopass/lib/theme";
import { useCommandPallete } from "../hooks";
import { SessionProvider } from "../contexts/session";
import { ToolbarSlotProvider } from "../containers/TopNavBar/toolbar-slot";
import { readAuthErrorFromUrl } from "@credopass/lib/supabase";
import { authErrorSearch } from "../lib/auth-error";

/**
 * Routes that render standalone — no sidebar, no top bar, no org switcher.
 *
 * Two reasons land here. `/login` is pre-console: there is no organization to
 * frame it with yet. `/e/`, `/p/` and `/invitations/`
 * are attendee surfaces — someone opened a link from a message. They have no
 * account, and console chrome would imply they could use one.
 *
 * `/events/new` is deliberately NOT here. It renders inside the console for a
 * signed-in host, and standalone-with-an-overlay for a visitor who arrived from
 * the marketing site; the page decides, not this list.
 */
const STANDALONE_ROUTES = [
  '/login',
  '/auth/',
  '/upgrade',
  '/invitations/',
  '/e/',
  '/p/',
];

export const Route = createRootRoute({
  /**
   * Catch a provider error on the way BACK from Google.
   *
   * GoTrue's `redirectErrors` sends `error` / `error_description` / `error_code`
   * to whatever `redirect_to` named — so the failure arrives on an ordinary app
   * route, not on one built to receive it. Before this, declining consent at
   * Google landed on `/events` with no session and no explanation: the console
   * simply behaved as though you had never signed in.
   *
   * It has to run HERE, in the root's `beforeLoad`, rather than in an effect on
   * mount. `/events` is behind `requireAuth`, whose own `beforeLoad` redirects
   * to `/login` first — so a mount effect never got the chance, and the error
   * was swallowed into a sign-in screen. The root's beforeLoad runs before any
   * child's.
   *
   * `replace` keeps the error URL out of history, so Back does not re-trigger it.
   */
  beforeLoad: ({ location }) => {
    if (location.pathname.startsWith('/auth/')) return;

    const search = location.searchStr ?? '';
    const hash = location.hash ? `#${location.hash}` : '';
    const problem = readAuthErrorFromUrl(`${location.pathname}${search}${hash}`);
    if (!problem) return;

    throw redirect({
      to: '/auth/error',
      search: authErrorSearch(problem),
      replace: true,
    });
  },
  component: RootRoute,
})

function RootRoute() {
  return (
    <SessionProvider>
      <RootLayout />
    </SessionProvider>
  );
}

export function RootLayout() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme } = useTheme();
  const { openCommandPalette } = useCommandPallete();

  const isStandalone = STANDALONE_ROUTES.some(r => pathname.startsWith(r));

  // Auth / attendee / device pages — no sidebar, no topbar
  if (isStandalone) {
    return (
      <>
        <div className="min-h-svh bg-background">
          <Outlet />
        </div>
        <Toaster position="top-center" richColors theme={theme} />
      </>
    );
  }

  return (
    <ToolbarSlotProvider>
      <div className="app-container">
        <div className="app-layout">
          <LeftSidebar
            nav={{ main: [...NAV_ITEMS] }}
            onCenterClick={openCommandPalette}
          >
            <SidebarInset className="main-content">
              <header className="app-header">
                <div className="flex items-center gap-2">
                  {isMobile ? <OrgSelector compact /> : <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors duration-150" />}
                  <Separator orientation="vertical" className="h-4 hidden md:block" />
                </div>
                <TopNavBar />
              </header>
              <div className="page-content">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full min-h-40">
                    <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                  </div>
                }>
                  <Outlet />
                </Suspense>
              </div>
            </SidebarInset>
          </LeftSidebar>

          <RightSidebar />
        </div>
        <ModalPortal />
      </div>
      <Toaster position="top-center" richColors theme={theme} />
    </ToolbarSlotProvider>
  );
}

