import type { ComponentType } from 'react'
import { Phone, Mail, Link2 } from 'lucide-react'
import {
  FaInstagram, FaFacebook, FaXTwitter, FaTiktok, FaDiscord, FaSnapchat, FaLinkedin,
} from 'react-icons/fa6'
import type { ContactMethodType } from '@/lib/database.types'

export interface ContactMethodMeta {
  label: string
  icon: ComponentType<{ className?: string; size?: number | string }>
  /** tel:/mailto: link builder — undefined means "render as plain text". */
  hrefPrefix?: string
  inputType: 'tel' | 'email' | 'text'
  placeholder: string
}

export const CONTACT_METHOD_META: Record<ContactMethodType, ContactMethodMeta> = {
  phone: { label: 'Phone', icon: Phone, hrefPrefix: 'tel:', inputType: 'tel', placeholder: '(407) 555-0000' },
  email: { label: 'Email', icon: Mail, hrefPrefix: 'mailto:', inputType: 'email', placeholder: 'you@example.com' },
  instagram: { label: 'Instagram', icon: FaInstagram, inputType: 'text', placeholder: '@dorkface' },
  facebook: { label: 'Facebook', icon: FaFacebook, inputType: 'text', placeholder: 'facebook.com/dorkface' },
  twitter: { label: 'X (Twitter)', icon: FaXTwitter, inputType: 'text', placeholder: '@dorkface' },
  tiktok: { label: 'TikTok', icon: FaTiktok, inputType: 'text', placeholder: '@dorkface' },
  discord: { label: 'Discord', icon: FaDiscord, inputType: 'text', placeholder: 'dorkface' },
  snapchat: { label: 'Snapchat', icon: FaSnapchat, inputType: 'text', placeholder: '@dorkface' },
  linkedin: { label: 'LinkedIn', icon: FaLinkedin, inputType: 'text', placeholder: 'linkedin.com/in/dorkface' },
  other: { label: 'Other / Social', icon: Link2, inputType: 'text', placeholder: 'Insta @dorkface' },
}

export const CONTACT_METHOD_TYPES = Object.keys(CONTACT_METHOD_META) as ContactMethodType[]

const PHONE_REGEX = /^[\d\s()+-]{7,20}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContactValue(type: ContactMethodType, value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Required, or remove this row.'
  if (trimmed.length > 200) return 'Too long (200 characters max).'
  if (type === 'phone' && !PHONE_REGEX.test(trimmed)) return 'Doesn’t look like a phone number.'
  if (type === 'email' && !EMAIL_REGEX.test(trimmed)) return 'Doesn’t look like an email address.'
  return null
}
