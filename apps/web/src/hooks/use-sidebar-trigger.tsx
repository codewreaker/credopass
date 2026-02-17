import { useAppStore } from '../stores/store';

export const useSidebarTrigger = () => {
  const toggleSidebar = useAppStore(({ toggleSidebar }) => toggleSidebar);
  const setViewedItem = useAppStore(state => state.setViewedItem);

  const onToggleCollapse = () => {
    setViewedItem(null);
    toggleSidebar('right');
  };

  return {
    onToggleCollapse
  };
};
