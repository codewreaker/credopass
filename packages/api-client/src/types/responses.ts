/**
 * API Response Types
 */

export interface APIError {
  message: string;
  cause?: {
    detail?: string;
    stack?: string;
  };
}

export interface APIResponse<T> {
  data?: T;
  error?: APIError;
}
