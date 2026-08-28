'use client'
import Link from 'next/link'
import { Mail, RefreshCw, CheckCircle } from 'lucide-react'
import { useEffect, useRef, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/wall'
  const email = searchParams.get('email') || ''
  const supabase = useMemo(() => createClient(), [])
  const hasNavigated = useRef(false)

  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const navigate = () => {
      if (hasNavigated.current) return
      hasNavigated.current = true
      router.push(redirectTo)
    }

    // Check immediately in case the user already verified before landing here
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email_confirmed_at) navigate()
    })

    // React to the verification click in real time (even from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) navigate()
    })

    return () => subscription.unsubscribe()
  }, [redirectTo, router, supabase])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return
    setResending(true)
    setResendMessage(null)
    try {
      const verifyBase = `${window.location.origin}/verify-email`
      const params = new URLSearchParams({ email })
      if (searchParams.get('redirect')) params.set('redirect', searchParams.get('redirect')!)
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${verifyBase}?${params.toString()}` },
      })
      if (error) {
        setResendMessage({ type: 'error', text: error.message })
      } else {
        setResendMessage({ type: 'success', text: 'Verification email sent! Please check your inbox (and spam folder).' })
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    } catch {
      setResendMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="card shadow-lg text-center animate-auth-card-in">
      <div className="w-14 h-14 bg-info/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pop-in" style={{ animationDelay: '200ms' }}>
        <Mail className="w-7 h-7 text-info" />
      </div>
      <h1 className="font-accent text-2xl font-bold text-text mb-2">Check Your Email</h1>
      <p className="text-text/60 text-sm mb-2">
        We&apos;ve sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}.
        Please click the link to activate your WDWShiftX account.
      </p>
      <p className="text-text/60 text-sm mb-6">
        Once verified, you&apos;ll be able to access the full shift board.
      </p>

      {resendMessage && (
        <div
          className={`mb-4 p-3 rounded-md border text-sm flex items-center gap-2 text-left ${
            resendMessage.type === 'success'
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-warning/10 border-warning/20 text-warning'
          }`}
        >
          {resendMessage.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {resendMessage.text}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs text-text/40">
          Didn&apos;t receive it? Check your spam or junk folder — verification emails sometimes end up there.
        </p>
        {email && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="btn btn-outline w-full gap-2"
          >
            {resending ? (
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {resending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend available in ${cooldown}s`
                : 'Resend Verification Email'}
          </button>
        )}
        <Link href="/login" className="btn btn-outline w-full">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
