/**
 * Event Service
 * Orchestration layer for event operations
 * Coordinates between EventModel and related models
 */

import { createEvent, getEventById } from '../models/EventModel';
import { getAttendanceByEvent } from '../models/AttendanceModel';
import type { Event, EventType, Attendance, EventMember } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';

/**
 * Create event with members
 * Creates an event and associates members with it
 */
export async function createEventWithMembers(
  eventData: Partial<EventType>,
  memberIds: string[]
): Promise<{
  event: Event;
  members: EventMember[];
}> {
  // Create the event
  const event = await createEvent(eventData);
  
  // Associate members with the event
  const collections = getCollections();
  const members: EventMember[] = [];
  
  for (const memberId of memberIds) {
    const eventMember = await collections.eventMembers.insert({
      eventId: event.id,
      memberId,
      status: 'invited',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as EventMember);
    members.push(eventMember);
  }
  
  return { event, members };
}

/**
 * Get event with attendance data
 * Fetches event and all related attendance records
 */
export async function getEventWithAttendance(eventId: string): Promise<{
  event: Event | undefined;
  attendance: Attendance[];
}> {
  const event = await getEventById(eventId);
  const attendance = event ? await getAttendanceByEvent(eventId) : [];
  
  return { event, attendance };
}
