/**
 * QR Code Utilities
 * Functions for generating and validating QR codes for event sign-in
 */

export interface SignInParams {
  type: 'qr_event_signin';
  eventId: string;
  eventName: string;
  eventLocation: string;
  staffId: string;
  staffEmail: string;
  staffName: string;
  sessionToken: string;
  qrSessionId: string;
  timestamp: number;
  expiresAt: number;
  apiEndpoint: string;
}

export const generateSignInParams = (session: any): SignInParams | null => {
  if (!session.activeEventId || !session.currentUserId || !session.sessionToken) {
    return null;
  }

  return {
    type: 'qr_event_signin',
    eventId: session.activeEventId,
    eventName: session.activeEventName || 'Unknown Event',
    eventLocation: session.activeEventLocation || 'Unknown Location',
    staffId: session.currentUserId,
    staffEmail: session.currentUserEmail || 'Unknown',
    staffName: session.currentUserName || 'Unknown',
    sessionToken: session.sessionToken,
    qrSessionId: session.qrSessionId,
    timestamp: session.qrGeneratedAt || Date.now(),
    expiresAt: session.qrExpiresAt || Date.now() + 5 * 60 * 1000,
    apiEndpoint: '', // Will be set by the calling code
  };
};

export const generateSignInUrl = (params: SignInParams): string => {
  // Create compact payload with only essential data
  const payload = {
    e: params.eventId,           // event ID
    s: params.staffId,           // staff ID
    t: params.sessionToken.substring(0, 12), // token hash
    q: params.qrSessionId,       // QR session ID
    x: params.expiresAt,         // expiry timestamp
  };
  
  // Encode to JSON then base64 URL-safe
  const jsonStr = JSON.stringify(payload);
  const base64 = btoa(jsonStr)
    .replace(/\+/g, '-')  // Replace + with -
    .replace(/\//g, '_')  // Replace / with _
    .replace(/=+$/, '');  // Remove trailing =
  
  const finalUrl = `${params.apiEndpoint}/signin?d=${base64}`;
  console.log('Generated Sign-In URL:', finalUrl);
  console.log('Payload length:', base64.length, 'chars');
  return finalUrl;
};
