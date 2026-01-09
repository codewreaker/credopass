/**
 * API Configuration
 * Automatically switches between development and production based on environment
 */
console.log('API_BASE_URL:', import.meta.env.VITE_API_URL);
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
