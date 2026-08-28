'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn, Clock, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations/auth'
import { OAuthButtons } from '@/components/ui/OAuthButtons'

const REASON_MESSAGES: Record<string, { icon: typeof Clock; text: string; style: string }> = {
  session_expired: {
    icon: Clock,
    text: 'Your session expired after 8 hours of inactivity. Please log in again.',
    style: 'bg-info/10 border-info/20 text-info',
  },
  deactivated: {
    icon: AlertTriangle,
    text: 'Your account has been deactivated. Please contact a board administrator.',
    style: 'bg-warning/10 border-warning/20 text-warning',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setReason(params.get('reason'))
  }, [])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [form, setForm] = useState({ email: '', password: '' })
  const [unverified, setUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setUnverified(false)
    setResendMessage(null)

    const result = loginSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: typeof errors = {}
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof typeof errors
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) {
        if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) {
          setUnverified(true)
        } else {
          setServerError(error.message)
        }
        return
      }
      router.push('/wall')
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!form.email || resendCooldown > 0 || resending) return
    setResending(true)
    setResendMessage(null)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: form.email,
        options: { emailRedirectTo: `${window.location.origin}/verify-email?email=${encodeURIComponent(form.email)}` },
      })
      if (error) {
        setResendMessage({ type: 'error', text: error.message })
      } else {
        setResendMessage({ type: 'success', text: 'Verification email sent! Please check your inbox (and spam folder).' })
        setResendCooldown(60)
      }
    } catch {
      setResendMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="card shadow-lg animate-auth-card-in">
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Welcome Back</h1>
      <p className="text-text/60 text-sm mb-6">Log in to access the shift board.</p>

      {reason && REASON_MESSAGES[reason] && (() => {
        const { icon: Icon, text, style } = REASON_MESSAGES[reason]
        return (
          <div className={`mb-4 p-3 rounded-md border text-sm flex items-start gap-2 ${style}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            {text}
          </div>
        )
      })()}

      {serverError && (
        <div key={serverError} className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm animate-shake">
          {serverError}
        </div>
      )}

      {unverified && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm animate-shake">
          <p className="mb-1">Your email address hasn&apos;t been verified yet.</p>
          <p className="text-xs opacity-80 mb-3">
            Check your inbox for the verification link — and your spam or junk folder, since it sometimes ends up there.
          </p>
          {resendMessage && (
            <div
              className={`mb-3 p-2 rounded-md border text-xs flex items-center gap-2 ${
                resendMessage.type === 'success'
                  ? 'bg-success/10 border-success/20 text-success'
                  : 'bg-warning/20 border-warning/30 text-warning'
              }`}
            >
              {resendMessage.type === 'success' && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
              {resendMessage.text}
            </div>
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            className="btn btn-outline w-full gap-2"
          >
            {resending ? (
              <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {resending
              ? 'Sending...'
              : resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : 'Resend Verification Email'}
          </button>
        </div>
      )}

      <OAuthButtons mode="login" />

      <form onSubmit={onSubmit} className="space-y-4 mt-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
            Email Address
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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-text">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline min-h-0 min-w-0"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`input pr-10 placeholder:text-text/40 ${errors.password ? 'border-warning' : ''}`}
              placeholder="••••••••"
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

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full gap-2"
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="text-center text-sm text-text/60 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline min-h-0 min-w-0">
          Register here
        </Link>
      </p>
    </div>
  )
}
