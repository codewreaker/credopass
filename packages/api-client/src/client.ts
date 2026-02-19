/**
 * API Client Configuration
 * Base client for data fetching across web and mobile
 */

export const API_BASE_URL = typeof window !== 'undefined' && (window as any).ENV_API_URL
  ? (window as any).ENV_API_URL
  : import.meta?.env?.VITE_API_URL || '/api/core';

export async function handleAPIErrors(response: Response) {
  if (!response.ok) {
    const { error: { cause } } = await response.json();
    console.error('======API Error======');
    console.error(cause?.stack);
    console.error('======API Error======');
    throw new Error(`${cause?.detail}`);
  }
}
