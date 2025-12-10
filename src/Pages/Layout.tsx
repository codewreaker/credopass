import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar";
import { LeftSidebar } from "../containers/LeftSidebar";
import { RightSidebar } from "../containers/RightSidebar";
import { SignInModal } from "../containers/SignInModal";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartNoAxesCombined,
} from "lucide-react";
import "../App.css";

export function RootLayout() {
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(true);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  return (
    <div className="app-container">
      <TopNavBar onNewEventClick={() => setShowSignInModal(true)} />

      <div className="app-layout">
        <LeftSidebar
          isCollapsed={leftSidebarCollapsed}
          onToggleCollapse={() =>
            setLeftSidebarCollapsed(!leftSidebarCollapsed)
          }
          menuConfig={[
            { path: "/", icon: LayoutDashboard, label: "Home" },
            { path: "/members", icon: Users, label: "Members" },
            {
              path: "/analytics",
              icon: ChartNoAxesCombined,
              label: "Analytics",
            },
            { path: "/calendar", icon: Calendar, label: "Calendar" },
          ]}
        />

        <main className="main-content">
          <Outlet />
        </main>

        <RightSidebar
          isCollapsed={rightSidebarCollapsed}
          onToggleCollapse={() =>
            setRightSidebarCollapsed(!rightSidebarCollapsed)
          }
        />
      </div>

      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </div>
  );
}
