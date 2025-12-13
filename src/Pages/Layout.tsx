import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar";
import { LeftSidebar } from "../containers/LeftSidebar";
import { RightSidebar } from "../containers/RightSidebar";
//import { SignInModal } from "../containers/SignInModal";
import ModalPortal from "../components/Launcher";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartNoAxesCombined,
  Database,
} from "lucide-react";
import "../App.css";


export function RootLayout() {

  return (
    <div className="app-container">
      <TopNavBar/>

      <div className="app-layout">
        <LeftSidebar
          menuConfig={[
            { path: "/", icon: LayoutDashboard, label: "Home" },
            { path: "/members", icon: Users, label: "Members" },
            {
              path: "/analytics",
              icon: ChartNoAxesCombined,
              label: "Analytics",
            },
            { path: "/events", icon: Calendar, label: "Events" },
            { path: "/database", icon: Database, label: "Tables" },
          ]}
        />

        <main className="main-content">
          <Outlet />
        </main>

        <RightSidebar/>
      </div>

      {/* <SignInModal /> */}
      <ModalPortal />
    </div>
  );
}
