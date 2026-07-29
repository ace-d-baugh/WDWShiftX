'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  LayoutGrid,
  Menu,
  X,
  ChevronDown,
  HelpCircle,
  MessageSquare,
} from 'lucide-react'
import { ThemedLogo } from '@/components/ui/ThemedLogo'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { GlobalRole } from '@/lib/database.types'
import { buildRoleDropdownItems, DropdownContent, fmtBadge } from '@/components/layout/AccountDropdown'

interface NavbarProps {
  userRole: GlobalRole
  displayName: string
  isBoardModerator?: boolean
  isLeader?: boolean
  pendingApprovalsCount?: number
  pendingFlagsCount?: number
  unreadMessagesCount?: number
}

export function Navbar({
  userRole,
  displayName,
  isBoardModerator = false,
  isLeader = false,
  pendingApprovalsCount = 0,
  pendingFlagsCount = 0,
  unreadMessagesCount = 0,
}: NavbarProps) {
  const pathname = usePathname()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const isAdmin = userRole === 'Admin'
  const showModItems = isBoardModerator || isAdmin
  const hasUnresolved = pendingApprovalsCount > 0 || pendingFlagsCount > 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Mobile menu open/close with exit animation
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openMobileMenu = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    setMobileMenuOpen(true)
    setMobileMenuClosing(false)
  }
  const closeMobileMenu = () => {
    if (mobileMenuClosing) return
    setMobileMenuClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setMobileMenuOpen(false)
      setMobileMenuClosing(false)
      closeTimerRef.current = null
    }, 200)
  }
  const toggleMobileMenu = () =>
    mobileMenuOpen && !mobileMenuClosing ? closeMobileMenu() : openMobileMenu()

  const isActive = (href: string) => pathname.startsWith(href)

  // ── Dropdown menu items (role-scoped) ──────────────────────────────────────
  const dropdownItems = buildRoleDropdownItems({
    isAdmin, showModItems, isLeader,
    pendingApprovalsCount, pendingFlagsCount,
  })

  return (
    <>
      {/* ── Desktop header ────────────────────────────────────────────────── */}
      <header className="hidden md:block sticky top-0 z-50 bg-card border-b border-border shadow-sm">

        {/* Top bar: Logo + account button */}
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between h-16">
          <Link href="/wall" className="flex flex-row items-center gap-0 align-baseline">
            <ThemedLogo priority className="h-12 w-auto" />
          </Link>

          {/* Help + Account */}
          <div className="flex items-center gap-0.5">
            <Link
              href="/help"
              className={cn(
                'p-1.5 rounded-md transition-colors min-h-0 min-w-0',
                isActive('/help') ? 'text-primary bg-primary-light' : 'text-text/40 hover:text-primary hover:bg-primary-light/50'
              )}
              aria-label="Help & Support"
              title="Help & Support"
            >
              <HelpCircle className="w-4 h-4" />
            </Link>

          {/* Account dropdown */}
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-text/60 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              <span className="relative">
                <span className="font-medium text-text">{displayName}</span>
                {hasUnresolved && (
                  <span className="absolute -top-0.5 -right-2 w-2 h-2 rounded-full bg-warning ring-2 ring-card" />
                )}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', accountMenuOpen && 'rotate-180')} />
            </button>

            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl z-50 py-1.5 overflow-hidden"
                >
                  <DropdownContent
                    items={dropdownItems}
                    handleLogout={handleLogout}
                    onNavigate={() => setAccountMenuOpen(false)}
                  />
                </div>
              </>
            )}
          </div>
          </div>{/* end help+account wrapper */}
        </div>

        {/* Sub-nav: tabs */}
        <div className="border-t border-border bg-card">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex items-center justify-center gap-1 h-10">
              {/* The Wall */}
              <Link
                href="/wall"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-0 min-w-0',
                  isActive('/wall')
                    ? 'bg-primary-light text-primary'
                    : 'text-text/60 hover:text-text hover:bg-primary-light/50'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                The Wall
              </Link>

              {/* My Calendar */}
              <Link
                href="/calendar"
                data-tour="nav-calendar"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-0 min-w-0',
                  isActive('/calendar')
                    ? 'bg-primary-light text-primary'
                    : 'text-text/60 hover:text-text hover:bg-primary-light/50'
                )}
              >
                <CalendarDays className="w-4 h-4" />
                My Calendar
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-0 min-w-0',
                  isActive('/messages')
                    ? 'bg-primary-light text-primary'
                    : 'text-text/60 hover:text-text hover:bg-primary-light/50'
                )}
              >
                <span className="relative">
                  <MessageSquare className="w-4 h-4" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning ring-2 ring-card" />
                  )}
                </span>
                Messages
                {fmtBadge(unreadMessagesCount) && (
                  <span className="flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-warning text-white text-[10px] font-bold leading-none">
                    {fmtBadge(unreadMessagesCount)}
                  </span>
                )}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ────────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="px-4 flex items-center justify-between h-14">
          <Link href="/wall" className="flex flex-row items-center gap-0 align-baseline">
            {/* Full logo (icon + wordmark), matching the login page and desktop */}
            <ThemedLogo priority className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/help"
              className={cn(
                'p-2 rounded-md transition-colors min-h-0 min-w-0',
                isActive('/help') ? 'text-primary bg-primary-light' : 'text-text/40 hover:text-primary hover:bg-primary-light/50'
              )}
              aria-label="Help & Support"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <button
              onClick={toggleMobileMenu}
              className="relative p-2 rounded-md text-text/60 hover:text-text hover:bg-primary-light transition-colors min-h-0 min-w-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen && !mobileMenuClosing
                ? <X className="w-5 h-5" />
                : (
                  <span className="relative inline-block">
                    <Menu className="w-5 h-5" />
                    {hasUnresolved && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warning ring-2 ring-card" />
                    )}
                  </span>
                )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div
            className="bg-card border-b border-border shadow-lg"
            style={{ animation: mobileMenuClosing ? 'navMenuClose 0.18s ease-in both' : 'navMenuOpen 0.38s ease-out both' }}
          >
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-xs text-text/40 font-medium uppercase tracking-wide">Signed in as</p>
              <p className="text-sm font-medium text-text">{displayName}</p>
            </div>
            <nav className="py-1.5">
              <DropdownContent
                items={dropdownItems}
                handleLogout={handleLogout}
                onNavigate={closeMobileMenu}
                mobile
              />
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop — closes the mobile menu when tapping outside the header */}
      {mobileMenuOpen && !mobileMenuClosing && (
        <div
          className="fixed inset-0 z-[49] md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile bottom nav (Wall + Calendar only) ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="flex items-stretch">
          {/* The Wall */}
          <Link
            href="/wall"
            className={cn(
              'flex flex-1 flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors min-h-[56px]',
              isActive('/wall') ? 'text-primary bg-primary-light/50' : 'text-text/50 hover:text-text'
            )}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">The Wall</span>
          </Link>

          {/* My Calendar */}
          <Link
            href="/calendar"
            data-tour="nav-calendar"
            className={cn(
              'flex flex-1 flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors min-h-[56px]',
              isActive('/calendar') ? 'text-primary bg-primary-light/50' : 'text-text/50 hover:text-text'
            )}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-[10px]">Calendar</span>
          </Link>

          {/* Messages */}
          <Link
            href="/messages"
            className={cn(
              'flex flex-1 flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors min-h-[56px]',
              isActive('/messages') ? 'text-primary bg-primary-light/50' : 'text-text/50 hover:text-text'
            )}
          >
            <span className="relative">
              <MessageSquare className="w-5 h-5" />
              {fmtBadge(unreadMessagesCount) && (
                <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-warning text-white text-[10px] font-bold leading-none ring-2 ring-card">
                  {fmtBadge(unreadMessagesCount)}
                </span>
              )}
            </span>
            <span className="text-[10px]">Messages</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
