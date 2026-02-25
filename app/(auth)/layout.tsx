import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-primary-light flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/logos/ShiftX-new.svg"
              alt="WDWShiftX"
              width={140}
              height={48}
              className="h-12 w-auto mx-auto"
              priority
            />
          </Link>
        </div>
        {children}
        <p className="text-center text-xs text-text/40 mt-8 px-4">
          Not affiliated with, authorized by, or endorsed by The Walt Disney Company.
        </p>
      </div>
    </div>
  )
}
