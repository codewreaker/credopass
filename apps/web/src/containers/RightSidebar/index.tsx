import React from 'react';
import { LucidePanelRightOpen, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../stores/store';
import ProfileView from './ProfileView';
import OverviewView from './OverviewView';
import QRSignInView, {handleManualSignIn, handleQRScan} from './QRSignInView';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@credopass/ui/components/sheet";

import { Button } from "@credopass/ui/components/button"

import './style.css';

export const RightSidebarTrigger: React.FC = () => {
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar);
  const setViewedItem = useAppStore(state => state.setViewedItem);

  const onToggleCollapse = () => {
    setViewedItem(null);
    toggleSidebar('right');
  }

  return (
    <button className="collapse-toggle-right" onClick={onToggleCollapse}>
      <LucidePanelRightOpen size={15} />
    </button>
  )
}

export const RightSidebar: React.FC = () => {
  const isCollapsed = useAppStore(({ sidebarOpen }) => (sidebarOpen['right']))
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar)
  const viewedItem = useAppStore(({ viewedItem }) => viewedItem)

  const onToggleCollapse = () => toggleSidebar('right')

  const getSidebarContent = (viewedItem: any) => {
    if (!viewedItem) {
      return <OverviewView />;
    }

    switch (viewedItem.id) {
      case 'profile':
        return <ProfileView data={viewedItem.content} />;
      case 'qr-signin':
        return <QRSignInView />;
      default:
        return <OverviewView />;
    }
  };

  const getSidebarTitle = () => {
    if (!viewedItem) {
      return "Overview";
    }

    switch (viewedItem.id) {
      case 'profile':
        return "Profile";
      case 'qr-signin':
        return "Check In";
      default:
        return "Overview";
    }
  };

  const getSidebarDescription = () => {
    if (!viewedItem) {
      return "Overview of loyalty status and upcoming events.";
    }

    switch (viewedItem.id) {
      case 'profile':
        return `${viewedItem.content?.firstName} ${viewedItem.content?.lastName}`;
      case 'qr-signin':
        return "Please Scan QR code or manually sign in.";
      default:
        return "Overview of loyalty status and upcoming events.";
    }
  };

  const getSidebarFooter = () => {
    if (!viewedItem) {
      return (
        <SheetClose>
          <Button variant="outline">Close</Button>
        </SheetClose>
      );
    }

    switch (viewedItem.id) {
      case 'profile':
        return (
          <>
            <Button type="submit">Save changes</Button>
            <SheetClose>
              <Button variant="outline">Close</Button>
            </SheetClose>
          </>
        );
      case 'qr-signin':
        return (
          <>
            <Button
              onClick={handleQRScan}
            >
              <ShieldCheck/> QR Code Scan
            </Button>
            <SheetClose>
              <Button
                onClick={handleManualSignIn}
                variant="outline"
                className="w-full"
              >
                Manual Sign In
              </Button>
            </SheetClose>
          </>
        );
      default:
        return (
          <SheetClose>
            <Button variant="outline">Close</Button>
          </SheetClose>
        );
    }
  };

  return (
    <Sheet open={isCollapsed} onOpenChange={onToggleCollapse}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{getSidebarTitle()}</SheetTitle>
          <SheetDescription>
            {getSidebarDescription()}
          </SheetDescription>
        </SheetHeader>
        {/**Sheet Content */}
        <div className="grid flex-1 auto-rows-min gap-6 px-4 h-[calc(100vh-52.5px)] overflow-y-auto sticky">
          <>
            {getSidebarContent(viewedItem)}
          </>
        </div>
        {/**Sheet Content */}
        <SheetFooter>
          {getSidebarFooter()}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
};
