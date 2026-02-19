/**
 * Mobile App Entry Point
 * TODO: Update to use new navigation structure
 */

import React from 'react';
import { View, Text } from 'react-native';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  // TODO: Add providers:
  // - Navigation container
  // - Theme provider
  // - Any other context providers
  
  return <RootNavigator />;
}
