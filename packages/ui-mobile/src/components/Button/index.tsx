/**
 * Button Component (React Native)
 * TODO: Implement full button component with variants
 */

import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ onPress, children }) => {
  // TODO: Implement full button with styles and variants
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{children}</Text>
    </TouchableOpacity>
  );
};
