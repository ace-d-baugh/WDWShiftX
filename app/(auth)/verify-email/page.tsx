import Link from 'next/link'
import { Mail } from 'lucide-react'

export const metadata = {
  title: 'Verify Email – WDWShiftX',
}

export default function VerifyEmailPage() {
  return (
    <div className="card shadow-lg text-center">
      <div className="w-14 h-14 bg-info/20 rounded-full flex items-center justify-center mx-auto mb-4">
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
