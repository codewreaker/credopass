/**
 * API Client Configuration
 * Base client for data fetching across web and mobile
 */

// Default fallback
let API_BASE_URL = '/api/core';

/**
 * Configure the API client with environment-specific settings
 * Must be called before using getCollections()
 */
export function configureAPIClient(config: { baseURL: string }) {
  API_BASE_URL = config.baseURL;
}

/**
 * Get the current API base URL
 */
export function getAPIBaseURL(): string {
  return API_BASE_URL;
}

export async function handleAPIErrors(response: Response) {
  if (!response.ok) {
    const { error: { cause } } = (await response.json()) as any;
    console.error('======API Error======');
    console.error(cause?.stack);
    console.error('======API Error======');
    throw new Error(`${cause?.detail}`);
  }
}
