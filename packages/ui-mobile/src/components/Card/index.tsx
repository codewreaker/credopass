/**
 * Card Component (React Native)
 * TODO: Implement full card component with elevation and variants
 */

import React from 'react';
import { View } from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  elevation?: number;
}

export const Card: React.FC<CardProps> = ({ children }) => {
  // TODO: Implement full card with styles
  return <View>{children}</View>;
};
