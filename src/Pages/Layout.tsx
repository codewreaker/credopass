import { Outlet } from "@tanstack/react-router";
import { TopNavBar } from "../containers/TopNavBar/index.js";
import { LeftSidebar } from "../containers/LeftSidebar/index.js";
import { RightSidebar } from "../containers/RightSidebar/index.js";
//import { SignInModal } from "../containers/SignInModal";
import ModalPortal from "../components/Launcher/index.js";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartNoAxesCombined,
  Database,
} from "lucide-react";
import "./layout.css";


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
