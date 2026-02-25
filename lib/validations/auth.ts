import { z } from 'zod'

export const hubIdRegex = /^[a-zA-Z]{5}\d{3}$/
export const pernerRegex = /^\d{8}$/
export const displayNameRegex = /^[A-Z][a-z]+ [A-Z]\.$/

export const registerSchema = z.object({
  display_name: z.string()
    .min(1, 'Display name is required')
    .regex(displayNameRegex, 'Format: "FirstName LastInitial." (e.g., "Matthew B.")'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  hub_id: z.string().regex(hubIdRegex, 'Invalid HubID format (e.g., BAUGM007)'),
  perner: z.string().regex(pernerRegex, 'Invalid PERNER format (8 digits)'),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms & Conditions' }) }),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
