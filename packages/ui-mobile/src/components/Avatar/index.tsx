/**
 * Avatar Component (React Native)
 * TODO: Implement avatar component with image support and fallback
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback }) => {
  // TODO: Implement full avatar with styles and image handling
  return (
    <View>
      {src ? <Image source={{ uri: src }} /> : <Text>{fallback}</Text>}
    </View>
  );
};
