import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar/index";
import LeftSidebar, { SidebarInset, SidebarTrigger, OrgSelector } from "../containers/LeftSidebar";

import { RightSidebar, RightSidebarTrigger } from "../containers/RightSidebar";

import ModalPortal from "../components/launcher";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartNoAxesCombined,
  Database,
  QrCode,
  Building2,
} from "lucide-react";
import "./layout.css";
import { useIsMobile } from "../hooks/use-mobile";
import { Toaster } from "@credopass/ui/components/sonner";
import { Separator } from "@credopass/ui/components/separator";

const NAV_ITEMS = [
  { url: "/checkin", icon: QrCode, label: "Check-In" },
  { url: "/dashboard", icon: LayoutDashboard, label: "Dashboard", isActive: true },
  { url: "/members", icon: Users, label: "Members" },
  { url: "/analytics", icon: ChartNoAxesCombined, label: "Analytics" },
  { url: "/events", icon: Calendar, label: "Events" },
  { url: "/organizations", icon: Building2, label: "Organizations" },
  { url: "/database", icon: Database, label: "Tables" },
] as const;

const USER_DATA = {
  name: 'Israel',
  email: 'israel.agyeman.prempeh@gmail.com',
  avatar: "/avatars/shadcn.jpg",
} as const;

export function RootLayout() {
  const isMobile = useIsMobile();

  return (
    <>
      <div className="app-container">
        <div className="app-layout">
          <LeftSidebar
            user={USER_DATA}
            nav={{ main: [...NAV_ITEMS] }}
          >
            <SidebarInset className="main-content">
              <header className="app-header">
                <div className="flex items-center gap-2">
                  {isMobile ? <OrgSelector /> : <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />}
                  <Separator orientation="vertical" className="h-4 hidden md:block" />
                </div>
                <TopNavBar />
                <RightSidebarTrigger />
              </header>
              <div className="page-content page-transition">
                <Outlet />
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
