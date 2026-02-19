/**
 * Screen Wrapper Component
 * Common wrapper for all screens
 * TODO: Implement screen wrapper with safe area
 */

import React from 'react';
import { View } from 'react-native';

export interface ScreenWrapperProps {
  children: React.ReactNode;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children }) => {
  // TODO: Implement with SafeAreaView
  return <View>{children}</View>;
};
