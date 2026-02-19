/**
 * Mobile App Entry Point
 * TODO: Update to use new navigation structure
 */

import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import { configureAPIClient } from '@credopass/api-client';
import RootNavigator from './navigation/RootNavigator';

// Configure API client with environment-specific URL
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/core';

export default function App() {
  useEffect(() => {
    // Configure API client on app startup
    configureAPIClient({ baseURL: API_BASE_URL });
    console.log('[Mobile] API configured with base URL:', API_BASE_URL);
  }, []);

  // TODO: Add providers:
  // - Navigation container
  // - Theme provider
  // - Any other context providers
  
  return <RootNavigator />;
}
