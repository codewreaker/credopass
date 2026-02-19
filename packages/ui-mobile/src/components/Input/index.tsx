/**
 * Input Component (React Native)
 * TODO: Implement full input component with validation and error states
 */

import React from 'react';
import { TextInput } from 'react-native';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
}

export const Input: React.FC<InputProps> = (props) => {
  // TODO: Implement full input with styles and error states
  return <TextInput {...props} />;
};
