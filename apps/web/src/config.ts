/**
 * API Configuration
 * Automatically switches between development and production based on environment
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/core';

/**
 * Mapbox Configuration
 */
export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

if (!MAPBOX_ACCESS_TOKEN) {
  console.warn(
    'Mapbox access token is not configured. Please set VITE_MAPBOX_ACCESS_TOKEN in your environment variables.'
  );
}