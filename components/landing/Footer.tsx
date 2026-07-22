import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-[#2F2040] text-white/60 py-8 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-row items-center gap-0 align-baseline">
            <Image
              src="/logos/WDWShiftX-Full-Logo-Gradient.png"
              alt="WDW ShiftX"
              width={6200}
              height={1024}
              className="h-12 w-auto brightness-0 invert opacity-60"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/data-deletion" className="hover:text-white transition-colors">Data Deletion</Link>
            <Link href="/login" className="hover:text-white transition-colors">Log In</Link>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10 text-xs text-center text-white/40">
          <p>
            WDW ShiftX is an independent platform and is not affiliated with, sponsored by,
            or endorsed by any specific employer. All trademarks are property of their
            respective owners.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} WDW ShiftX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
