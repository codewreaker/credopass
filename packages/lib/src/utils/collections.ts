/**
 * Collection utilities
 * Shared functions for working with TanStack DB collections
 */

import { getCollections } from '@credopass/api-client/collections';

/**
 * Delete an item from a collection by ID
 * @param collectionName - Name of the collection
 * @param id - ID of the item to delete
 * @param onClose - Optional callback to call after deletion
 */
export async function handleCollectionDeleteById(
  collectionName: string,
  id: string,
  onClose?: () => void
) {
  const collections = getCollections();
  const collection = collections[collectionName as keyof typeof collections];
  
  if (!collection) {
    throw new Error(`Collection "${collectionName}" not found`);
  }

  await collection.deleteById(id);
  
  if (onClose) {
    onClose();
  }
}
