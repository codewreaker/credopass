/**
 * Event Model
 * Pure TypeScript functions for event operations
 * No React, no JSX - just business logic
 */

import type { Event, EventType } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Get all events
 */
export async function getEvents(): Promise<Event[]> {
  const collections = getCollections();
  return collections.events.findAll();
}

/**
 * Get event by ID
 */
export async function getEventById(id: string): Promise<Event | undefined> {
  const collections = getCollections();
  return collections.events.findById(id);
}

/**
 * Create a new event
 */
export async function createEvent(eventData: Partial<EventType>): Promise<Event> {
  const collections = getCollections();
  return collections.events.insert(eventData as Event);
}

/**
 * Update an existing event
 */
export async function updateEvent(id: string, eventData: Partial<EventType>): Promise<Event> {
  const collections = getCollections();
  const existing = await collections.events.findById(id);
  if (!existing) throw new Error('Event not found');
  
  return collections.events.update({
    ...existing,
    ...eventData,
  } as Event);
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
  const collections = getCollections();
  const event = await collections.events.findById(id);
  if (!event) throw new Error('Event not found');
  
  return collections.events.delete(event);
}
