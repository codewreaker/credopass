/**
 * Collection utilities
 * Shared functions for working with TanStack DB collections
 */

import { getCollections, type CredoPassCollections } from '@credopass/api-client/collections';

// Type helper to get only collection names (excluding queryClient)
type CollectionName = Exclude<keyof CredoPassCollections, 'queryClient'>;

/**
 * Delete an item from a collection by ID
 * @param collectionName - Name of the collection
 * @param id - ID of the item to delete
 * @param onClose - Optional callback to call after deletion
 */
export async function handleCollectionDeleteById(
  collectionName: CollectionName,
  id: string,
  onClose?: () => void
) {
  const collections = getCollections();
  const collection = collections[collectionName];
  
  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found`);
  }

  await collection.delete(id);
  
  if (onClose) {
    onClose();
  }
}
