import { Suspense } from "react";
import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
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
import { PremiumProvider } from "../contexts/premium";

// Routes that render standalone without the app shell
const STANDALONE_ROUTES = ['/login', '/upgrade'];

export const Route = createRootRoute({
  component: RootRoute,
})

/** Entitlements wrap the whole tree, standalone pages included. */
function RootRoute() {
  return (
    <PremiumProvider>
      <RootLayout />
    </PremiumProvider>
  );
}

export function RootLayout() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme } = useTheme();
  const { openCommandPalette } = useCommandPallete();

  const isStandalone = STANDALONE_ROUTES.some(r => pathname.startsWith(r));

  // Auth / standalone pages — no sidebar, no topbar
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
    <>
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
    </>
  );
}
