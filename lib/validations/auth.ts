import { z } from 'zod'

// Full name: a capitalised first name plus at least one more capitalised word
// (the last name), space- or hyphen-separated. e.g. "Thomas Morrow",
// "Mary Ann Morrow", "Jean-Pierre Leblanc". No trailing initial.
export const displayNameRegex = /^[A-Z][a-zA-Z]*(?:[-\s][A-Z][a-zA-Z]*)+$/

// Letters, spaces, and hyphens only — keeps the derived site display name
// ("First Last") valid under displayNameRegex above.
const nameRegex = /^[A-Za-z]+(?:[-\s][A-Za-z]+)*$/

// Mirrors what's enforced in Supabase Dashboard → Authentication → Policies
// (min length + upper/lower/digit/symbol, set 2026-07-19). Shared with
// <PasswordStrengthMeter> so the live checklist and the submit-time Zod
// validation can never drift out of sync — this array is the one source of
// truth for both.
export interface PasswordRequirement {
  key: string
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: 'length', label: 'At least 8 characters',      test: v => v.length >= 8 },
  { key: 'upper',  label: 'One uppercase letter (A-Z)',  test: v => /[A-Z]/.test(v) },
  { key: 'lower',  label: 'One lowercase letter (a-z)',  test: v => /[a-z]/.test(v) },
  { key: 'digit',  label: 'One number (0-9)',            test: v => /[0-9]/.test(v) },
  { key: 'symbol', label: 'One symbol (!@#$…)',          test: v => /[^A-Za-z0-9]/.test(v) },
]

export function passwordMeetsRequirements(value: string): boolean {
  return PASSWORD_REQUIREMENTS.every(r => r.test(value))
}

const passwordSchema = z.string().refine(passwordMeetsRequirements, {
  message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
})

// disney.com: Disney's mail servers silently drop our verification emails.
// Everything else: disposable/throwaway inboxes used by fake-account bots to
// clear email verification without a real address. Mirrored in the
// handle_new_user() DB trigger so a direct API call can't bypass this — see
// supabase/migrations for the matching domain check. Keep both lists in sync.
const BLOCKED_EMAIL_DOMAINS = [
  'disney.com',
  // Disposable / temp-mail providers
  '0-mail.com', '0815.ru', '0clickemail.com', '10minutemail.com', '10minutemail.net',
  '1secmail.com', '1secmail.net', '1secmail.org', '20minutemail.com', '33mail.com',
  'anonbox.net', 'boximail.com', 'burnermail.io', 'byom.de', 'crazymailing.com',
  'deadaddress.com', 'dispostable.com', 'dropmail.me', 'emailondeck.com',
  'emailsensei.com', 'fakeinbox.com', 'fakemailgenerator.com', 'getairmail.com',
  'getnada.com', 'grr.la', 'guerrillamail.com', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com',
  'inboxbear.com', 'inboxkitten.com', 'jetable.org', 'kasmail.com',
  'luxusmail.org', 'mail-temporaire.fr', 'mailcatch.com', 'maildrop.cc',
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailnesia.com',
  'mailpoof.com', 'mailsac.com', 'mintemail.com', 'mytemp.email',
  'mohmal.com', 'moakt.com', 'nada.email', 'noclickemail.com',
  'no-spam.ws', 'notsharingmy.info', 'obobbo.com', 'onewaymail.com',
  'owlymail.com', 'pokemail.net', 'putthisinyourspamdatabase.com',
  'quickemailverification.com', 'sharklasers.com', 'shieldedmail.com',
  'spam4.me', 'spamavert.com', 'spambog.com', 'spambox.us', 'spamgourmet.com',
  'spamherelots.com', 'spamthisplease.com', 'spamex.com', 'spamfree24.org',
  'superrito.com', 'tempail.com', 'tempinbox.com', 'tempmail.com',
  'tempmail.de', 'tempmailo.com', 'tempmail2.com', 'temp-mail.org',
  'temp-mail.io', 'tempr.email', 'throwawaymail.com', 'trashmail.com',
  'trashmail.net', 'trbvm.com', 'tyldd.com', 'wegwerfemail.de',
  'wegwerfmail.de', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'zetmail.com',
]
const BLOCKED_EMAIL_DOMAIN_SET = new Set(BLOCKED_EMAIL_DOMAINS)

function hasBlockedEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').pop() ?? ''
  return BLOCKED_EMAIL_DOMAIN_SET.has(domain)
}

export const registerSchema = z.object({
  first_name: z.string().trim()
    .min(1, 'First name is required')
    .max(40, 'First name is too long')
    .regex(nameRegex, 'Letters, spaces, and hyphens only'),
  last_name: z.string().trim()
    .min(1, 'Last name is required')
    .max(40, 'Last name is too long')
    .regex(nameRegex, 'Letters, spaces, and hyphens only'),
  email: z.string().email('Invalid email address')
    .refine(email => !hasBlockedEmailDomain(email), 'Please use a different email address to register.'),
  password: passwordSchema,
  confirm_password: z.string().min(1, 'Please confirm your password'),
  terms_accepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms & Conditions' }) }),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
