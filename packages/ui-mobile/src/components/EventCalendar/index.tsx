/**
 * EventCalendar Component (React Native)
 * TODO: Implement calendar component for events
 */

import React from 'react';
import { View } from 'react-native';

export interface EventCalendarProps {
  events: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
  }>;
  onEventPress?: (eventId: string) => void;
}

export const EventCalendar: React.FC<EventCalendarProps> = ({ events }) => {
  // TODO: Implement full calendar with month/week/day views
  // Consider using react-native-calendars
  return <View>{/* Calendar will be rendered here */}</View>;
};
