import { getCollections, type CredoPassCollections } from "../tanstack-db";
import { toast } from 'sonner';

export function getGreeting(): string {
  const GREETINGS: Record<string, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  };
  const hour = new Date().getHours();
  if (hour < 12) return GREETINGS.morning;
  if (hour < 17) return GREETINGS.afternoon;
  return GREETINGS.evening;
}


type CollectionKeyList = Exclude<keyof CredoPassCollections, 'queryClient'>;

const singularMap:Record<string, string> = {
  users: 'user',
  organizations: 'organization',
  events: 'event',
  orgMemberships: 'orgMembership',
  eventMembers: 'eventMember'
};

export const handleCollectionDeleteById = (
  collectionId: CollectionKeyList,
  id?: string,
  callback?: () => void
) => {
  if (!id) {
    toast.error('No id selected to Delete');
    return
  }

  const deleteElement = async () => {
    const collection = getCollections()[collectionId];
    try {
      await collection?.delete(id);
      toast.success(`${collection} id:${id} deleted`);
      callback?.();
    } catch (error) {
      console.error(`Failed to delete ${collectionId}:`, error);
      toast.error(`Failed to delete ${collectionId}`);
      callback?.()
    }
  }


  const collectionName = singularMap[collectionId] ?? collectionId;

  toast(
    `Delete ${collectionName}!`, {
    description: `Are you sure you want to delete ${collectionName}? this cannot be undone`,
    action: {
      label: "Delete",
      onClick: deleteElement,
    },
    actionButtonStyle:{
      color: 'var(--foreground)',
      background:'var(--destructive)' 
    },
    cancel: {
      label: 'Cancel',
      onClick: () => {},
    }
  })
};

