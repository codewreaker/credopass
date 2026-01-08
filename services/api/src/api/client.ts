// ============================================================================
// FILE: packages/api-client/src/client.ts
// Type-safe API client for DwellPass
// ============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function request<T>(
  baseUrl: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    let details: unknown;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
      details = errorData.details;
    } catch {
      // Ignore JSON parse errors
    }
    
    throw new ApiError(response.status, errorMessage, details);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * Create a type-safe API client instance
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl } = config;

  return {
    /**
     * Generic GET request
     */
    get: <T>(endpoint: string, params?: Record<string, string>) => {
      const url = params 
        ? `${endpoint}?${new URLSearchParams(params).toString()}`
        : endpoint;
      return request<T>(baseUrl, url);
    },

    /**
     * Generic POST request
     */
    post: <T, D = unknown>(endpoint: string, data?: D) =>
      request<T>(baseUrl, endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),

    /**
     * Generic PUT request
     */
    put: <T, D = unknown>(endpoint: string, data?: D) =>
      request<T>(baseUrl, endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      }),

    /**
     * Generic PATCH request
     */
    patch: <T, D = unknown>(endpoint: string, data?: D) =>
      request<T>(baseUrl, endpoint, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      }),

    /**
     * Generic DELETE request
     */
    delete: <T = void>(endpoint: string) =>
      request<T>(baseUrl, endpoint, { method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
