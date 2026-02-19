/**
 * Check-In Service
 * Orchestration layer for check-in operations
 * Coordinates between AttendanceModel and EventModel
 */

import { checkIn, checkInManual, validateQRCode } from '../models/AttendanceModel';
import { getEventById } from '../models/EventModel';
import type { Attendance } from '../schemas';

/**
 * Process QR code check-in
 * Validates QR code and creates attendance record
 */
export async function processQRCheckIn(qrCode: string): Promise<{
  success: boolean;
  attendance?: Attendance;
  error?: string;
}> {
  try {
    // Validate QR code
    const validation = await validateQRCode(qrCode);
    
    if (!validation.valid || !validation.eventId || !validation.memberId) {
      return {
        success: false,
        error: 'Invalid QR code',
      };
    }
    
    // Verify event exists
    const event = await getEventById(validation.eventId);
    if (!event) {
      return {
        success: false,
        error: 'Event not found',
      };
    }
    
    // Create attendance record
    const attendance = await checkIn(validation.eventId, validation.memberId, qrCode);
    
    return {
      success: true,
      attendance,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process manual check-in
 * Creates attendance record without QR code
 */
export async function processManualCheckIn(
  eventId: string,
  memberId: string
): Promise<{
  success: boolean;
  attendance?: Attendance;
  error?: string;
}> {
  try {
    // Verify event exists
    const event = await getEventById(eventId);
    if (!event) {
      return {
        success: false,
        error: 'Event not found',
      };
    }
    
    // Create attendance record
    const attendance = await checkInManual(eventId, memberId);
    
    return {
      success: true,
      attendance,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate and check in
 * Generic check-in that handles both QR and manual
 */
export async function validateAndCheckIn(
  eventId: string,
  memberId: string,
  qrCode?: string
): Promise<{
  success: boolean;
  attendance?: Attendance;
  error?: string;
}> {
  if (qrCode) {
    return processQRCheckIn(qrCode);
  }
  return processManualCheckIn(eventId, memberId);
}
