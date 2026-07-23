import React from 'react';
import { LucidePanelRightOpen } from 'lucide-react';
import { useAppStore } from '@credopass/lib/stores';
import { useNavigate } from '@tanstack/react-router';
import { useSidebarTrigger } from '../../../../../packages/lib/src/hooks/use-sidebar-trigger';
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
import { Avatar, AvatarFallback, AvatarImage } from "@credopass/ui/components/avatar"

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
  const navigate = useNavigate()

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
        return "Member profile";
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
        <SheetClose>
          <Button variant="outline" size="sm">Close</Button>
        </SheetClose>
      );
    }

    switch (viewedItem.id) {
      case 'profile':
        return (
          <div className="flex items-center gap-2 w-full">
            <Button
              size="sm"
              className="flex-1 rounded-full font-semibold"
              onClick={() => {
                toggleSidebar('right', false);
                navigate({
                  to: '/members/$userId/edit',
                  params: { userId: viewedItem?.content?.id },
                });
              }}
            >
              Edit member
            </Button>
            <SheetClose>
              <Button variant="outline" size="sm" className="rounded-full">Close</Button>
            </SheetClose>
          </div>
        );
      default:
        return (
          <SheetClose>
            <Button variant="outline" size="sm">Close</Button>
          </SheetClose>
        );
    }
  };

  return (
    <Sheet open={isCollapsed} onOpenChange={onToggleCollapse}>
      <SheetContent className="right-sheet-content">
        <SheetHeader className="right-sheet-header">
          {viewedItem?.id === 'profile' && viewedItem?.content ? (
            <div className="flex items-center gap-3 min-w-0 pr-8">
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={viewedItem.content.avatarUrl} alt="" />
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {`${(viewedItem.content.firstName || ' ')[0] ?? ''}${(viewedItem.content.lastName || ' ')[0] ?? ''}`.trim().toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold truncate">
                  {`${viewedItem.content.firstName || ''} ${viewedItem.content.lastName || ''}`.trim() || 'Member'}
                </SheetTitle>
                <SheetDescription className="text-xs capitalize">
                  {(viewedItem.content.tier || 'bronze')} member
                </SheetDescription>
              </div>
            </div>
          ) : (
            <>
              <SheetTitle className="text-sm font-semibold">{getSidebarTitle()}</SheetTitle>
              <SheetDescription className="text-xs">
                {getSidebarDescription()}
              </SheetDescription>
            </>
          )}
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
