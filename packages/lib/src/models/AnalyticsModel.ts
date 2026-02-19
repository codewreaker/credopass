/**
 * Analytics Model
 * Pure TypeScript functions for analytics and reporting
 * No React, no JSX - just business logic
 */

import type { Attendance, Event } from '../schemas';
import { getCollections } from '@credopass/api-client/collections';
import { getAttendanceByEvent } from './AttendanceModel';

/**
 * Get attendance summary for an event
 */
export async function getAttendanceSummary(eventId: string): Promise<{
  totalAttendees: number;
  checkedIn: number;
  pending: number;
  checkInRate: number;
}> {
  const collections = getCollections();
  const attendance = await getAttendanceByEvent(eventId);
  const event = await collections.events.findById(eventId);
  
  const checkedIn = attendance.filter(a => a.checkInTime).length;
  const totalAttendees = event?.capacity || checkedIn;
  
  return {
    totalAttendees,
    checkedIn,
    pending: Math.max(0, totalAttendees - checkedIn),
    checkInRate: totalAttendees > 0 ? (checkedIn / totalAttendees) * 100 : 0,
  };
}

/**
 * Get event statistics
 */
export async function getEventStats(organizationId?: string): Promise<{
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  activeEvents: number;
}> {
  const collections = getCollections();
  const allEvents = await collections.events.findAll();
  const events = organizationId 
    ? allEvents.filter(e => e.organizationId === organizationId)
    : allEvents;
  
  const now = new Date();
  
  return {
    totalEvents: events.length,
    upcomingEvents: events.filter(e => new Date(e.startTime) > now).length,
    pastEvents: events.filter(e => new Date(e.endTime) < now).length,
    activeEvents: events.filter(e => e.status === 'active').length,
  };
}

/**
 * Get loyalty statistics for an organization
 */
export async function getLoyaltyStats(organizationId: string): Promise<{
  totalMembers: number;
  totalPoints: number;
  averagePoints: number;
}> {
  const collections = getCollections();
  const allLoyalty = await collections.loyalty.findAll();
  const loyalty = allLoyalty.filter(l => l.organizationId === organizationId);
  
  const totalPoints = loyalty.reduce((sum, l) => sum + l.pointsEarned, 0);
  
  return {
    totalMembers: loyalty.length,
    totalPoints,
    averagePoints: loyalty.length > 0 ? totalPoints / loyalty.length : 0,
  };
}
