import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import AuthErrorPage from '../../Pages/AuthError'

/**
 * Coerce whatever arrived in the URL into text.
 *
 * TanStack Router parses JSON-shaped search values, so `?raw={"code":400}`
 * reaches the component as an OBJECT, not a string — and rendering an object as
 * a React child throws. That is how this route crashed the first time it was
 * handed a real payload: the error page became a second error.
 */
const asText = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const text = (max: number) =>
  z.preprocess(asText, z.string().max(max).optional()).catch(undefined)

/**
 * `/auth/error` — a sign-in that never produced a session.
 *
 * Nothing is required and every field catches on its own. This route is only
 * ever reached from a failure, so it must not be able to fail itself: a bad
 * value falls back to generic copy rather than throwing on top of the original
 * error, and one bad field does not discard the rest (which a single `.catch({})`
 * on the object would).
 */
export const Route = createFileRoute('/auth/error')({
  validateSearch: z.object({
    title: text(200),
    detail: text(600),
    code: text(100),
    status: z.coerce.number().int().optional().catch(undefined),
    provider: text(40),
    raw: text(4000),
  }),
  component: AuthErrorPage,
})
