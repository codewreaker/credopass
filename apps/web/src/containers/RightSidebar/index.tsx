import React from 'react';
import { LucidePanelRightOpen } from 'lucide-react';
import { useAppStore } from '../../stores/store';
import ProfileView from './ProfileView';
import OverviewView from './OverviewView';
import QRSignInView from './QRSignInView';

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
    switch (true) {
      case viewedItem !== null:
        return <ProfileView data={viewedItem} />;
      default:
        return <OverviewView />;
    }
  };

  const getSidebarTitle = () => {
    return viewedItem !== null ? "Profile" : "Overview";
  };

  const getSidebarDescription = () => {
    if (viewedItem !== null) {
      return `${viewedItem?.firstName} ${viewedItem?.lastName}`;
    }
    return "Overview of loyalty status and upcoming events.";
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
          <Button type="submit">Save changes</Button>
          <SheetClose>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
};
