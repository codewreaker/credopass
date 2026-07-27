/**
 * Shared plumbing for the hooks. Not exported from the package.
 */

/**
 * Drop openapi-fetch's `{ data, error }` envelope.
 *
 * The client's response middleware throws `ApiError` on any non-2xx, so by the
 * time this runs the request has succeeded and `data` is present. Returning the
 * body directly is what lets TanStack Query treat a failure as a rejected
 * promise rather than a resolved value that every call site has to re-check.
 */
export async function unwrap<T>(request: PromiseLike<{ data?: T }>): Promise<T> {
  const { data } = await request;
  return data as T;
}

/** Strip undefined so an unset filter never becomes `?q=undefined` in a key. */
export function compact<T extends Record<string, unknown>>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as T;
}
