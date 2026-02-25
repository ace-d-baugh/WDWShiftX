'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutGrid,
  User,
  ShieldCheck,
  Flag,
  Archive,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/database.types'

interface NavbarProps {
  userRole: UserRole
  displayName: string
}

const navItems = [
  { href: '/board', label: 'Board', icon: LayoutGrid, roles: ['cast', 'copro', 'leader', 'admin'] },
  { href: '/profile', label: 'Profile', icon: User, roles: ['cast', 'copro', 'leader', 'admin'] },
  { href: '/leader/approvals', label: 'Approvals', icon: ShieldCheck, roles: ['leader', 'admin'] },
  { href: '/leader/flags', label: 'Flags', icon: Flag, roles: ['leader', 'admin'] },
  { href: '/leader/archive', label: 'Archive', icon: Archive, roles: ['leader', 'admin'] },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
] as const

export function Navbar({ userRole, displayName }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const visibleItems = navItems.filter(item =>
    (item.roles as readonly string[]).includes(userRole)
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <>
      {/* Desktop top navbar */}
      <header className="hidden md:flex sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/board" className="flex items-center min-h-0 min-w-0">
            <Image
              src="/logos/ShiftX-new.svg"
              alt="WDWShiftX"
              width={120}
              height={40}
              className="h-9 w-auto"
            />
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
            {visibleItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-0 min-w-0',
                  isActive(href)
                    ? 'bg-primary-light text-primary'
                    : 'text-text/60 hover:text-text hover:bg-primary-light/50'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text/60 font-medium">{displayName}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-text/60 hover:text-warning hover:bg-warning/10 transition-colors min-h-0 min-w-0"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="px-4 flex items-center justify-between h-14">
          <Link href="/board" className="min-h-0 min-w-0">
            <Image
              src="/logos/ShiftX-new.svg"
              alt="WDWShiftX"
              width={100}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-text/60 hover:text-text hover:bg-primary-light transition-colors min-h-0 min-w-0"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="bg-white border-b border-border shadow-lg">
            <div className="px-4 py-2 border-b border-border">
              <p className="text-xs text-text/40 font-medium uppercase tracking-wide">Signed in as</p>
              <p className="text-sm font-medium text-text">{displayName}</p>
            </div>
            <nav className="py-2">
              {visibleItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                    isActive(href)
                      ? 'bg-primary-light text-primary'
                      : 'text-text/70 hover:bg-primary-light/50 hover:text-text'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-warning hover:bg-warning/10 transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-area-pb">
        <div className="flex items-stretch">
          {visibleItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors min-h-[56px]',
                isActive(href)
                  ? 'text-primary bg-primary-light/50'
                  : 'text-text/50 hover:text-text'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
