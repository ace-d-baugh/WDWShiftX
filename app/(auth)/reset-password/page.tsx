'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema } from '@/lib/validations/auth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [form, setForm] = useState({ password: '', confirm_password: '' })
  const [errors, setErrors] = useState<{ password?: string; confirm_password?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const result = resetPasswordSchema.safeParse(form)
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
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) {
        setServerError(error.message)
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/board'), 2000)
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="card shadow-lg text-center">
        <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <h1 className="font-accent text-2xl font-bold text-text mb-2">Password Updated!</h1>
        <p className="text-text/60 text-sm">Redirecting you to the board...</p>
      </div>
    )
  }

  return (
    <div className="card shadow-lg">
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Set New Password</h1>
      <p className="text-text/60 text-sm mb-6">Choose a strong new password for your account.</p>

      {serverError && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text mb-1">
            New Password
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
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-warning">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-text mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              name="confirm_password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className={`input pr-10 ${errors.confirm_password ? 'border-warning' : ''}`}
              placeholder="Repeat your password"
              value={form.confirm_password}
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 h-auto w-auto p-1"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirm_password && <p className="mt-1 text-xs text-warning">{errors.confirm_password}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full gap-2">
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <KeyRound className="w-4 h-4" />
          )}
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
