/**
 * Navigation Types
 * Type definitions for React Navigation
 * TODO: Add route parameters as needed
 */

export type RootStackParamList = {
  Home: undefined;
  Events: undefined;
  CheckIn: undefined;
  Members: undefined;
  Organizations: undefined;
  Analytics: undefined;
  Tables: undefined;
};

export type EventsStackParamList = {
  EventList: undefined;
  EventDetail: { eventId: string };
  EventForm: { eventId?: string };
};

export type CheckInStackParamList = {
  QRScanner: undefined;
  ManualSignIn: undefined;
  Success: { memberId: string; eventId: string };
};

export type MembersStackParamList = {
  MemberList: undefined;
  MemberDetail: { memberId: string };
};
