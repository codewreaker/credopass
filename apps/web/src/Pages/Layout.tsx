import { Suspense, useMemo } from "react";
import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar/index";
import LeftSidebar, { SidebarInset, SidebarTrigger, OrgSelector } from "../containers/LeftSidebar";

import { RightSidebar } from "../containers/RightSidebar";

import ModalPortal from "../components/launcher";
import "./layout.css";
import { useIsMobile } from "@credopass/ui/hooks/use-mobile";
import { Toaster } from "@credopass/ui/components/sonner";
import { Separator } from "@credopass/ui/components/separator";
import { NAV_ITEMS } from "@credopass/lib/constants";
import { useCommandPallete } from "../hooks";


export function RootLayout() {
  const isMobile = useIsMobile();
  //Exclude Organisations from menu
  const main = useMemo(() => (NAV_ITEMS.filter(({ id }) => (id !== 'organizations'))), []);
  const { openCommandPalette } = useCommandPallete();
  return (
    <>
      <div className="app-container">
        <div className="app-layout">
          <LeftSidebar
            nav={{ main }}
            onCenterClick={openCommandPalette}
          >
            <SidebarInset className="main-content">
              <header className="app-header">
                <div className="flex items-center gap-2">
                  {isMobile ? <OrgSelector compact /> : <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />}
                  <Separator orientation="vertical" className="h-4 hidden md:block" />
                </div>
                <TopNavBar />
              </header>
              <div className="page-content page-transition">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
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
      <Toaster
        position="top-center"
        richColors
      />
    </>
  );
}
