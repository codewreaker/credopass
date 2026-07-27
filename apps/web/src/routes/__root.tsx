import { Suspense, useEffect } from "react";
import { createRootRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
import { SessionProvider, useSession } from "../contexts/session";
import { ToolbarSlotProvider } from "../containers/TopNavBar/toolbar-slot";

/**
 * Routes that render standalone — no sidebar, no top bar, no org switcher.
 *
 * Three different reasons land here. `/login` and `/onboarding` are pre-console:
 * there is no organization to frame them with yet. `/e/`, `/p/` and
 * `/checkin/pair` are attendee and device surfaces — someone opened a link from
 * a message, or a tablet is being set up. Neither has an account, and showing
 * them console chrome would imply they could use it.
 */
const STANDALONE_ROUTES = [
  '/login',
  '/reset-password',
  '/upgrade',
  '/onboarding',
  '/invitations/',
  '/e/',
  '/p/',
  '/checkin/pair',
];

export const Route = createRootRoute({
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
                  <OnboardingGate>
                    <Outlet />
                  </OnboardingGate>
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

/**
 * A brand-new account belongs to no organization, so every console query
 * correctly returns nothing. Without somewhere to land, enforcing tenancy would
 * break the product for every new user — so the console redirects rather than
 * rendering an empty shell (§2.2).
 *
 * It **wraps** the outlet rather than sitting beside it. Navigation happens in
 * an effect, which runs *after* children have mounted — so as a sibling this
 * let org-scoped screens mount, fire their queries and, worse, accept a submit
 * in the frame before the redirect landed. `POST /events` with no active
 * organization answers `403 not_a_member` ("This account belongs to no
 * organization yet"), which is both a dead end and the wrong thing to tell
 * someone who simply has not created an organization yet.
 *
 * Blocking here fixes it once for every org-scoped route, rather than needing a
 * `beforeLoad` guard on each one that would have to re-fetch `/me/context`
 * outside the api-client (golden rule 2).
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { needsOnboarding, isContextLoading, isPairedDevice } = useSession();
  const navigate = useNavigate();

  // A paired device has no account and never onboards; it must not be bounced.
  const blocked = !isContextLoading && !isPairedDevice && needsOnboarding;

  useEffect(() => {
    if (!blocked) return;
    navigate({ to: '/onboarding', replace: true });
  }, [blocked, navigate]);

  if (blocked) {
    return (
      <div className="flex items-center justify-center h-full min-h-40">
        <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
