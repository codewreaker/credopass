import React from 'react';
import { LucidePanelRightOpen } from 'lucide-react';
import { useAppStore } from '@credopass/lib/stores';
import { useSidebarTrigger } from '../../hooks/use-sidebar-trigger';
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

export const RightSidebarTrigger: React.FC<{ icon?: React.JSX.Element }> = ({
  icon = <LucidePanelRightOpen size={12} className='text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'/>
}) => {
  const { onToggleCollapse } = useSidebarTrigger();

  return (
    <Button
      variant='outline'
      size={'icon-sm'}
      onClick={onToggleCollapse}
    >
      {icon}
    </Button>

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
      case 'calendar':
        return <OverviewView />;
      default:
        return <OverviewView />;
    }
  };

  const getSidebarTitle = () => {
    if (!viewedItem) return "Overview";

    switch (viewedItem.id) {
      case 'profile':
        return "Profile";
      case 'calendar':
        return "Calendar";
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
      case 'calendar':
        return "View your upcoming events at a glance.";
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
