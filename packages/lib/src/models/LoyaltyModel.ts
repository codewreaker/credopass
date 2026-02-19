/**
 * Loyalty Model
 * Pure TypeScript functions for loyalty program operations
 * No React, no JSX - just business logic
 */

import type { Loyalty } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Get loyalty records for a member
 */
export async function getLoyaltyByMember(memberId: string): Promise<Loyalty[]> {
  const collections = getCollections();
  const allLoyalty = await collections.loyalty.findAll();
  return allLoyalty.filter(record => record.memberId === memberId);
}

/**
 * Award loyalty points to a member
 */
export async function awardPoints(
  memberId: string,
  organizationId: string,
  points: number,
  reason: string
): Promise<Loyalty> {
  const collections = getCollections();
  
  const loyaltyRecord: Partial<Loyalty> = {
    memberId,
    organizationId,
    pointsEarned: points,
    // reason, // TODO: Add reason field to schema if needed
    issuedAt: new Date(),
  };
  
  return collections.loyalty.insert(loyaltyRecord as Loyalty);
}
