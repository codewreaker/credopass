/**
 * Loader Component (React Native)
 * TODO: Implement loading spinner component
 */

import React from 'react';
import { ActivityIndicator } from 'react-native';

export interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'small', color }) => {
  // TODO: Customize with theme colors
  return <ActivityIndicator size={size} color={color} />;
};
