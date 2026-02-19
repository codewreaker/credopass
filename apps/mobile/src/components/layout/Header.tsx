/**
 * Header Component
 * Common header for screens
 * TODO: Implement header component
 */

import React from 'react';
import { View, Text } from 'react-native';

export interface HeaderProps {
  title: string;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  // TODO: Implement header with back button
  return (
    <View>
      <Text>{title}</Text>
    </View>
  );
};
