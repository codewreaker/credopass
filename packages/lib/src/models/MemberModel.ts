/**
 * Member Model
 * Pure TypeScript functions for member operations
 * No React, no JSX - just business logic
 */

import type { User } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Get all members (users)
 */
export async function getMembers(): Promise<User[]> {
  const collections = getCollections();
  return collections.users.findAll();
}

/**
 * Get member by ID
 */
export async function getMemberById(id: string): Promise<User | undefined> {
  const collections = getCollections();
  return collections.users.findById(id);
}

/**
 * Update member information
 */
export async function updateMember(id: string, memberData: Partial<User>): Promise<User> {
  const collections = getCollections();
  const existing = await collections.users.findById(id);
  if (!existing) throw new Error('Member not found');
  
  return collections.users.update({
    ...existing,
    ...memberData,
  } as User);
}
