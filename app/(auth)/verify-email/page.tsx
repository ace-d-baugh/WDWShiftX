'use client'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/wall'
  const supabase = useMemo(() => createClient(), [])
  const hasNavigated = useRef(false)

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

  return (
    <div className="card shadow-lg text-center animate-auth-card-in">
      <div className="w-14 h-14 bg-info/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pop-in" style={{ animationDelay: '200ms' }}>
        <Mail className="w-7 h-7 text-info" />
      </div>
      <h1 className="font-accent text-2xl font-bold text-text mb-2">Check Your Email</h1>
      <p className="text-text/60 text-sm mb-2">
        We&apos;ve sent a verification link to your email address.
        Please click the link to activate your WDWShiftX account.
      </p>
      <p className="text-text/60 text-sm mb-6">
        Once verified, you&apos;ll be able to access the full shift board.
      </p>
      <div className="space-y-3">
        <p className="text-xs text-text/40">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <Link href="/login" className="btn btn-outline w-full">
          Back to Login
        </Link>
      </div>
    </div>
  )
}
