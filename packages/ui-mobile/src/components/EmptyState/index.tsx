/**
 * EmptyState Component (React Native)
 * TODO: Implement empty state component with icon and message
 */

import React from 'react';
import { View, Text } from 'react-native';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  // TODO: Implement full empty state with styles
  return (
    <View>
      <Text>{title}</Text>
      {description && <Text>{description}</Text>}
      {action}
    </View>
  );
};
