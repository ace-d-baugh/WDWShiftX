'use client'

import { useState } from 'react'
import { ChevronDown, LayoutGrid, CalendarDays, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { ThemedLogo } from '@/components/ui/ThemedLogo'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { GlobalRole } from '@/lib/database.types'
import { buildRoleDropdownItems, DropdownContent, fmtBadge, type DropdownItemDef } from '@/components/layout/AccountDropdown'

interface LandingHeaderProps {
  displayName: string | null
  userRole?: GlobalRole
  isBoardModerator?: boolean
  isLeader?: boolean
  pendingApprovalsCount?: number
  pendingFlagsCount?: number
  unreadMessagesCount?: number
}

export function LandingHeader({
  displayName,
  userRole = 'Guest',
  isBoardModerator = false,
  isLeader = false,
  pendingApprovalsCount = 0,
  pendingFlagsCount = 0,
  unreadMessagesCount = 0,
}: LandingHeaderProps) {
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const isLoggedIn = !!displayName

  const isAdmin = userRole === 'Admin'
  const showModItems = isBoardModerator || isAdmin
  const hasNotifications = pendingApprovalsCount > 0 || pendingFlagsCount > 0 || unreadMessagesCount > 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    window.location.reload()
  }

  // Unlike the dashboard Navbar (which has a separate Wall/Calendar/Messages
  // tab strip), this header has only the one dropdown — so those live here
  // as ordinary items, each carrying its own badge when it has something
  // pending, ahead of the same role-gated items the dashboard menu shows.
  const primaryItems: DropdownItemDef[] = [
    { type: 'link', href: '/wall', label: 'The Wall', icon: LayoutGrid },
    { type: 'link', href: '/calendar', label: 'My Calendar', icon: CalendarDays },
    { type: 'link', href: '/messages', label: 'Messages', icon: MessageSquare, badge: fmtBadge(unreadMessagesCount) },
    { type: 'separator' },
  ]
  const dropdownItems = [
    ...primaryItems,
    ...buildRoleDropdownItems({ isAdmin, showModItems, isLeader, pendingApprovalsCount, pendingFlagsCount }),
  ]

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border animate-slide-down">
      <div className={cn(
          'max-w-6xl mx-auto px-4 py-3',
          isLoggedIn
            ? 'flex items-center justify-between'
            : 'flex flex-col sm:flex-row items-center gap-2 sm:justify-between'
        )}>
        <Link href={isLoggedIn ? '/wall' : '/'} className="flex flex-row items-center gap-0 align-baseline">
          {/* Full logo (icon + wordmark) at every breakpoint — smaller on mobile */}
          <ThemedLogo priority className="h-10 md:h-14 w-auto" />
        </Link>

        <nav className={cn(
            'flex items-center gap-3',
            !isLoggedIn && 'w-full justify-center sm:w-auto sm:justify-end'
          )}>
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-text/70 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="relative">
                  <span className="font-medium">{displayName}</span>
                  {hasNotifications && (
                    <span className="absolute -top-0.5 -right-2 w-2 h-2 rounded-full bg-warning ring-2 ring-card" />
                  )}
                </span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', menuOpen && 'rotate-180')} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl z-50 py-1.5 overflow-hidden"
                  >
                    <DropdownContent
                      items={dropdownItems}
                      handleLogout={handleLogout}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline text-sm px-4 py-2 min-h-0 h-10">
                Log In
              </Link>
              <Link href="/register" className="btn btn-primary text-sm px-4 py-2 min-h-0 h-10">
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
