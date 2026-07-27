import { z } from 'zod'

const emailField = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address')

/**
 * Sign-IN password: presence only.
 *
 * Deliberately NOT the sign-up rules. Applying strength requirements here would
 * reject people whose existing password predates the rules — they would be told
 * their own correct password is invalid, with no way forward. Whether it is
 * right is the server's answer to give, not the form's.
 */
export const emailPasswordSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})

/** The rules a NEW password must satisfy, each carrying its own message. */
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
] as const

const newPasswordField = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, { message: rule.label }),
  z.string() as z.ZodType<string>
)

/**
 * Sign-UP: strength rules plus a confirmation field.
 *
 * The match check is a `superRefine` on the object rather than a field
 * validator because it needs both values; the error is attached to
 * `confirmPassword` so it renders under the field the person can fix.
 */
export const signUpSchema = z
  .object({
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      })
    }
  })

/** Setting a new password after a recovery link — same rules, no email. */
export const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      })
    }
  })

export const forgotPasswordSchema = z.object({ email: emailField })

/** How many of the rules a password currently satisfies — drives the meter. */
export const passwordStrength = (value: string): number =>
  PASSWORD_RULES.filter((rule) => rule.test(value)).length

export type EmailPasswordValues = z.infer<typeof emailPasswordSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
