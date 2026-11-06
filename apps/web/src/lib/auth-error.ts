import type { AuthProblem } from '@credopass/lib/supabase'

/**
 * Turn an `AuthProblem` into the search params `/auth/error` renders.
 *
 * Everything is a string in a URL and everything is optional on the far side,
 * so a malformed problem degrades to generic copy rather than throwing a second
 * error on top of the first. `raw` is capped because the route caps it too —
 * a provider that returns an HTML error page would otherwise push a kilobyte of
 * markup through the address bar.
 */
export function authErrorSearch(problem: unknown): Record<string, string | number> {
  const p = (problem ?? {}) as Partial<AuthProblem>
  const search: Record<string, string | number> = {}

  if (p.title) search.title = p.title.slice(0, 200)
  if (p.detail) search.detail = p.detail.slice(0, 600)
  if (p.code) search.code = p.code.slice(0, 100)
  if (typeof p.status === 'number') search.status = p.status
  if (p.provider) search.provider = p.provider.slice(0, 40)
  if (p.raw) search.raw = p.raw.slice(0, 4000)

  return search
}
