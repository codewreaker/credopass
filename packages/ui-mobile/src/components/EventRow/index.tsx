/**
 * EventRow Component (React Native)
 * TODO: Implement event row component for event lists
 */

import React from 'react';
import { View, Text } from 'react-native';

export interface EventRowProps {
  title: string;
  date: Date;
  location?: string;
  attendeeCount?: number;
}

export const EventRow: React.FC<EventRowProps> = ({ title, date }) => {
  // TODO: Implement full event row with styles
  return (
    <View>
      <Text>{title}</Text>
      <Text>{date.toLocaleDateString()}</Text>
    </View>
  );
};
