import { z } from 'zod'

export const emailPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(8, 'Must be at least 8 characters'),
})

export type EmailPasswordValues = z.infer<typeof emailPasswordSchema>
