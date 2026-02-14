import React from 'react';
import { LucidePanelRightOpen } from 'lucide-react';
import { useAppStore } from '../../stores/store';
import ProfileView from './ProfileView';
import OverviewView from './OverviewView';

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
    <button
      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      onClick={onToggleCollapse}
      aria-label="Toggle sidebar"
    >
      <LucidePanelRightOpen size={16} />
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
      default:
        return <OverviewView />;
    }
  };

  const getSidebarTitle = () => {
    if (!viewedItem) return "Overview";

    switch (viewedItem.id) {
      case 'profile':
        return "Profile";
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
      default:
        return "Overview of loyalty status and upcoming events.";
    }
  };

  const getSidebarFooter = () => {
    if (!viewedItem) {
      return (
        <SheetClose asChild>
          <Button variant="outline" size="sm">Close</Button>
        </SheetClose>
      );
    }

    switch (viewedItem.id) {
      case 'profile':
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save changes
            </Button>
            <SheetClose asChild>
              <Button variant="outline" size="sm">Close</Button>
            </SheetClose>
          </div>
        );
      default:
        return (
          <SheetClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </SheetClose>
        );
    }
  };

  return (
    <Sheet open={isCollapsed} onOpenChange={onToggleCollapse}>
      <SheetContent className="right-sheet-content">
        <SheetHeader className="right-sheet-header">
          <SheetTitle className="text-sm font-semibold">{getSidebarTitle()}</SheetTitle>
          <SheetDescription className="text-xs">
            {getSidebarDescription()}
          </SheetDescription>
        </SheetHeader>

        <div className="right-sheet-body">
          {getSidebarContent(viewedItem)}
        </div>

        <SheetFooter className="right-sheet-footer">
          {getSidebarFooter()}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
};
