'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, UserPlus, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  registerSchema,
  hubIdRegex,
  pernerRegex,
  type RegisterInput,
} from '@/lib/validations/auth'
import { z } from 'zod'

type FieldErrors = Partial<Record<keyof RegisterInput, string>>

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [hubWarning, setHubWarning] = useState(false)

  const [form, setForm] = useState({
    display_name: '',
    email: '',
    password: '',
    hub_id: '',
    perner: '',
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
    setServerError(null)
    setHubWarning(false)

    // Validate HubID and PERNER format (never stored)
    const hubValid = hubIdRegex.test(form.hub_id)
    const pernerValid = pernerRegex.test(form.perner)

    if (!hubValid || !pernerValid) {
      setHubWarning(true)
      if (!hubValid) setErrors(prev => ({ ...prev, hub_id: 'Invalid HubID format (e.g., BAUGM007)' }))
      if (!pernerValid) setErrors(prev => ({ ...prev, perner: 'Invalid PERNER format (8 digits)' }))
      return
    }

    // Validate with Zod schema
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
      // NOTE: HubID and PERNER are validated above but NEVER sent to the server
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            display_name: form.display_name,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      })

      if (error) {
        setServerError(error.message)
        return
      }

      if (data.user && !data.session) {
        router.push('/verify-email')
      } else {
        router.push('/board')
        router.refresh()
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card shadow-lg">
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Create Account</h1>
      <p className="text-text/60 text-sm mb-6">Join the WDWShiftX Cast Member community.</p>

      {hubWarning && (
        <div className="mb-4 p-3 rounded-md bg-accent/20 border border-accent text-text text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>HubID or PERNER verification failed. Please check your credentials. These are never stored.</span>
        </div>
      )}

      {serverError && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-text mb-1">
            Display Name <span className="text-warning">*</span>
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            className={`input ${errors.display_name ? 'border-warning' : ''}`}
            placeholder="Matthew B."
            value={form.display_name}
            onChange={handleChange}
          />
          <p className="mt-1 text-xs text-text/40">Format: FirstName LastInitial. (e.g., &ldquo;Matthew B.&rdquo;)</p>
          {errors.display_name && (
            <p className="mt-1 text-xs text-warning">{errors.display_name}</p>
          )}
        </div>

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
            className={`input ${errors.email ? 'border-warning' : ''}`}
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
              className={`input pr-10 ${errors.password ? 'border-warning' : ''}`}
              placeholder="Min. 8 characters"
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
          {errors.password && (
            <p className="mt-1 text-xs text-warning">{errors.password}</p>
          )}
        </div>

        {/* HubID */}
        <div>
          <label htmlFor="hub_id" className="block text-sm font-medium text-text mb-1">
            HubID <span className="text-warning">*</span>
          </label>
          <input
            id="hub_id"
            name="hub_id"
            type="text"
            autoComplete="off"
            className={`input ${errors.hub_id ? 'border-warning' : ''}`}
            placeholder="BAUGM007"
            value={form.hub_id}
            onChange={handleChange}
          />
          <p className="mt-1 text-xs text-text/40">5 letters + 3 digits. Used for verification only — never stored.</p>
          {errors.hub_id && (
            <p className="mt-1 text-xs text-warning">{errors.hub_id}</p>
          )}
        </div>

        {/* PERNER */}
        <div>
          <label htmlFor="perner" className="block text-sm font-medium text-text mb-1">
            PERNER <span className="text-warning">*</span>
          </label>
          <input
            id="perner"
            name="perner"
            type="text"
            autoComplete="off"
            inputMode="numeric"
            className={`input ${errors.perner ? 'border-warning' : ''}`}
            placeholder="12345678"
            value={form.perner}
            onChange={handleChange}
            maxLength={8}
          />
          <p className="mt-1 text-xs text-text/40">8-digit employee number. Used for verification only — never stored.</p>
          {errors.perner && (
            <p className="mt-1 text-xs text-warning">{errors.perner}</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3">
          <input
            id="terms_accepted"
            name="terms_accepted"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary min-h-0 min-w-0"
            checked={form.terms_accepted}
            onChange={handleChange}
          />
          <label htmlFor="terms_accepted" className="text-sm text-text/70 min-h-0">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="text-primary hover:underline min-h-0 min-w-0">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline min-h-0 min-w-0">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.terms_accepted && (
          <p className="text-xs text-warning -mt-2">{errors.terms_accepted}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full gap-2"
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
