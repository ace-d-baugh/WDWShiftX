'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema } from '@/lib/validations/auth'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="card shadow-lg text-center">
        <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <h1 className="font-accent text-2xl font-bold text-text mb-2">Check Your Email</h1>
        <p className="text-text/60 text-sm mb-6">
          We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link.
        </p>
        <Link href="/login" className="btn btn-primary w-full">
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="card shadow-lg">
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-text/60 hover:text-text mb-4 min-h-0 min-w-0">
        <ArrowLeft className="w-4 h-4" /> Back to Login
      </Link>
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Forgot Password?</h1>
      <p className="text-text/60 text-sm mb-6">
        Enter your email address and we&apos;ll send you a reset link.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full gap-2">
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  )
}
