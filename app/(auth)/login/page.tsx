'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations/auth'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [form, setForm] = useState({ email: '', password: '' })

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
        setServerError(error.message)
        return
      }
      router.push('/board')
      router.refresh()
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card shadow-lg">
      <h1 className="font-accent text-2xl font-bold text-text mb-1">Welcome Back</h1>
      <p className="text-text/60 text-sm mb-6">Log in to access the shift board.</p>

      {serverError && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
            Email Address
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
              className={`input pr-10 ${errors.password ? 'border-warning' : ''}`}
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
