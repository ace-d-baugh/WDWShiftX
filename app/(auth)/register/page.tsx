  'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, UserPlus, Ticket } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/Checkbox'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { OAuthButtons } from '@/components/ui/OAuthButtons'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { REGISTRATION_PAUSED } from '@/lib/registration'

type FieldErrors = Partial<Record<keyof RegisterInput, string>>

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? ''
  const oauthBlocked = searchParams.get('oauth_blocked') === '1'
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  // Invite code carried in from a QR scan / share link — either directly
  // (?code=XXXXXXX) or embedded in the board-page redirect (?redirect=/boards/slug?c=XXXXXXX).
  // Stored in signup metadata AND localStorage so /welcome can auto-send the
  // join request even if the redirect chain breaks (e.g. verified on another device).
  const inviteCode = useMemo(() => {
    const direct = searchParams.get('code') ?? ''
    const fromRedirect = /[?&]c=([A-Za-z0-9]{7})/.exec(redirect)?.[1] ?? ''
    return (direct || fromRedirect).toUpperCase()
  }, [searchParams, redirect])

  useEffect(() => {
    if (!inviteCode) return
    try { localStorage.setItem('wdwshiftx-pending-invite', inviteCode) } catch {}
  }, [inviteCode])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    terms_accepted: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name as keyof FieldErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (REGISTRATION_PAUSED) return
    setServerError(null)

    const parseResult = registerSchema.safeParse({
      ...form,
      terms_accepted: form.terms_accepted as true,
    })

    if (!parseResult.success) {
      const fieldErrors: FieldErrors = {}
      parseResult.error.errors.forEach(err => {
        const field = err.path[0] as keyof FieldErrors
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      // The public.users profile row is created automatically by a DB trigger on auth.users.
      const verifyBase = `${window.location.origin}/verify-email`
      const emailRedirectTo = redirect
        ? `${verifyBase}?redirect=${encodeURIComponent(redirect)}`
        : verifyBase

      // given_name/family_name use the same metadata keys Google OAuth sends,
      // so the handle_new_user trigger derives the site display name
      // ("First Last") identically for both paths. full_name fills the Supabase
      // auth Display Name; users can still edit theirs later (same convention).
      const first = parseResult.data.first_name
      const last = parseResult.data.last_name
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo,
          data: {
            given_name: first,
            family_name: last,
            full_name: `${first} ${last}`,
            ...(inviteCode && { invite_code: inviteCode }),
          },
        },
      })

      if (error) {
        setServerError(error.message)
        return
      }

      const verifyPath = redirect
        ? `/verify-email?redirect=${encodeURIComponent(redirect)}`
        : '/verify-email'

      if (data.user && !data.session) {
        router.push(verifyPath)
      } else {
        router.push(redirect || '/wall')
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card shadow-lg animate-auth-card-in">
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Create Account</h1>
      <p className="text-text/60 text-sm mb-6">Join the WDWShiftX community.</p>

      {REGISTRATION_PAUSED && (
        <div className="mb-4 p-3 rounded-md bg-info/10 border border-info/20 text-info text-sm">
          {oauthBlocked
            ? "We couldn't create your account — new registrations (including sign-in with Google/Facebook/LinkedIn) are temporarily paused while we get ready for launch. Check back soon!"
            : 'New registrations are temporarily paused while we get ready for launch — check back soon!'}{' '}
          Existing members can still{' '}
          <Link href="/login" className="font-medium underline min-h-0 min-w-0">log in</Link>.
        </div>
      )}

      {serverError && (
        <div key={serverError} className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm animate-shake">
          {serverError}
        </div>
      )}

      {!REGISTRATION_PAUSED && inviteCode && (
        <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-sm flex items-center gap-2">
          <Ticket className="w-4 h-4 text-success shrink-0" />
          <span className="text-text/80">
            Invite code <strong className="font-mono">{inviteCode}</strong> detected — we&rsquo;ll
            send your board join request automatically after you sign up.
          </span>
        </div>
      )}

      {!REGISTRATION_PAUSED && <OAuthButtons mode="register" />}

      <form onSubmit={onSubmit} className="space-y-4 mt-4" noValidate>
        {/* Name — becomes the Supabase display name; the site name shown to
            boards is derived as "First L." (editable later, same convention) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-text mb-1">
              First Name <span className="text-warning">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              className={`input placeholder:text-text/50 ${errors.first_name ? 'border-warning' : ''}`}
              placeholder="Thomas"
              value={form.first_name}
              onChange={handleChange}
            />
            {errors.first_name && (
              <p className="mt-1 text-xs text-warning">{errors.first_name}</p>
            )}
          </div>
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-text mb-1">
              Last Name <span className="text-warning">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              className={`input placeholder:text-text/50 ${errors.last_name ? 'border-warning' : ''}`}
              placeholder="Morrow"
              value={form.last_name}
              onChange={handleChange}
            />
            {errors.last_name && (
              <p className="mt-1 text-xs text-warning">{errors.last_name}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-text/50 -mt-2">
          Boards will see you as &ldquo;{form.first_name.trim() && form.last_name.trim()
            ? `${form.first_name.trim()} ${form.last_name.trim()}`
            : 'First Last'}&rdquo; — you can adjust this in your profile.
        </p>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
            Email Address <span className="text-warning">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={`input placeholder:text-text/50 ${errors.email ? 'border-warning' : ''}`}
            placeholder="your@email.com"
            value={form.email}
            onChange={handleChange}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-warning">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
            Password <span className="text-warning">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`input pr-10 placeholder:text-text/50 ${errors.password ? 'border-warning' : ''}`}
              placeholder="Create a strong password"
              value={form.password}
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 h-auto w-auto p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthMeter password={form.password} />
          {errors.password && (
            <p className="mt-1 text-xs text-warning">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-text mb-1">
            Confirm Password <span className="text-warning">*</span>
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              name="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`input pr-10 placeholder:text-text/50 ${errors.confirm_password ? 'border-warning' : ''}`}
              placeholder="Re-enter your password"
              value={form.confirm_password}
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 h-auto w-auto p-1"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="mt-1 text-xs text-warning">{errors.confirm_password}</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms_accepted"
            name="terms_accepted"
            className="mt-1"
            checked={form.terms_accepted}
            onChange={handleChange}
          />
          <label htmlFor="terms_accepted" className="text-sm text-text/70 min-h-0">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="text-primary hover:underline min-h-0 min-w-0">
              Terms &amp; Conditions
            </Link>
            ,{' '}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline min-h-0 min-w-0">
              Privacy Policy
            </Link>
            , and{' '}
            <Link href="/data-deletion" target="_blank" className="text-primary hover:underline min-h-0 min-w-0">
              Data Deletion Policy
            </Link>
            . I understand how my data is stored and how to request its deletion.
          </label>
        </div>
        {errors.terms_accepted && (
          <p className="text-xs text-warning -mt-2">{errors.terms_accepted}</p>
        )}

        <button
          type="submit"
          disabled={REGISTRATION_PAUSED || loading || !form.terms_accepted}
          className={`btn btn-primary w-full gap-2 ${REGISTRATION_PAUSED || !form.terms_accepted ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-text/60 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline min-h-0 min-w-0">
          Log in
        </Link>
      </p>
    </div>
  )
}
