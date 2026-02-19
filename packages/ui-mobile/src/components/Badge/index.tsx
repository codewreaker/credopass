/**
 * Badge Component (React Native)
 * TODO: Implement badge component with variants and colors
 */

import React from 'react';
import { View, Text } from 'react-native';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const Badge: React.FC<BadgeProps> = ({ children }) => {
  // TODO: Implement full badge with styles
  return (
    <View>
      <Text>{children}</Text>
    </View>
  );
};
