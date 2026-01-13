import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar/index";
import LeftSidebar, { SidebarInset, SidebarTrigger } from "../containers/LeftSidebar";

import { RightSidebar, RightSidebarTrigger } from "../containers/RightSidebar";
//import { SignInModal } from "../containers/SignInModal";

import ModalPortal from "../components/launcher";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartNoAxesCombined,
  Database,
} from "lucide-react";
import "./layout.css";
import { useIsMobile } from "../hooks/use-mobile";


export function RootLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="app-container">

      <div className="app-layout">
        <LeftSidebar
          user={{
            name: 'Israel',
            email: 'israel.agyeman.prempeh@gmail.com',
            avatar: "/avatars/shadcn.jpg",
          }}
          teams={[
            {
              label: "Kharis Church",
              plan: "Enterprise",
            },
            {
              label: "Kharis Church",
              plan: "Free",
            },
            {
              label: "Kharis Phase 2",
              plan: "Free",
            },
          ]}
          nav={{
            main: [
              {
                url: "/",
                icon: LayoutDashboard,
                label: "Home",
                isActive: true
              },
              {
                url: "/members",
                icon: Users,
                label: "Members"
              },
              {
                url: "/analytics",
                icon: ChartNoAxesCombined,
                label: "Analytics",
              },
              {
                url: "/events",
                icon: Calendar,
                label: "Events"
              },
              {
                url: "/database",
                icon: Database,
                label: "Tables"
              },
            ],
            examples: [{
              url: "/component-example",
              icon: LayoutDashboard,
              label: "Components"
            }]
          }}
        >
          <SidebarInset className="main-content">
            <header className="flex justify-between h-16 shrink-0 items-center gap-2 border-b px-4">
              {!isMobile && <SidebarTrigger className="-ml-1" />}
              <TopNavBar />
              <RightSidebarTrigger />
            </header>
            <Outlet />
          </SidebarInset>
        </LeftSidebar>

        <RightSidebar />
      </div>

      {/* <SignInModal /> */}
      <ModalPortal />
    </div>
  );
}
