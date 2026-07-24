import Link from 'next/link'
import {
  User,
  ShieldCheck,
  Flag,
  Archive,
  LogOut,
  HelpCircle,
  Settings,
  Kanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownItemDef {
  type: 'link' | 'separator'
  href?: string
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string | null
}

export function fmtBadge(n: number): string | null {
  return n > 99 ? '99+' : n > 0 ? String(n) : null
}

/** Profile/Help + role-gated items (mod: Approvals/Flags/Archive, admin: Overlord Panel/Roadmap). */
export function buildRoleDropdownItems({
  isAdmin, showModItems, isLeader,
  pendingApprovalsCount, pendingFlagsCount,
}: {
  isAdmin: boolean
  showModItems: boolean
  isLeader: boolean
  pendingApprovalsCount: number
  pendingFlagsCount: number
}): DropdownItemDef[] {
  const items: DropdownItemDef[] = [
    { type: 'link', href: '/profile', label: 'Profile', icon: User },
    { type: 'link', href: '/help',    label: 'Help & Support', icon: HelpCircle },
  ]

  if (showModItems) {
    items.push({ type: 'separator' })
    items.push({
      type: 'link',
      href: '/leader/approvals',
      label: 'Approvals',
      icon: ShieldCheck,
      badge: fmtBadge(pendingApprovalsCount),
    })
    items.push({
      type: 'link',
      href: '/leader/flags',
      label: 'Flags',
      icon: Flag,
      badge: fmtBadge(pendingFlagsCount),
    })
    if (isLeader) {
      items.push({
        type: 'link',
        href: '/leader/archive',
        label: 'Archive',
        icon: Archive,
      })
    }
  }

  if (isAdmin) {
    items.push({ type: 'separator' })
    items.push({ type: 'link', href: '/admin',  label: 'Overlord Panel', icon: Settings })
    items.push({ type: 'link', href: '/kanban', label: 'Roadmap',     icon: Kanban })
  }

  return items
}

export function DropdownContent({
  items, handleLogout, onNavigate, mobile = false,
}: {
  items: DropdownItemDef[]
  handleLogout: () => void
  onNavigate: () => void
  mobile?: boolean
}) {
  const base = mobile
    ? 'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors w-full text-left'
    : 'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors w-full text-left'

  return (
    <>
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={i} className="my-1 border-t border-border" />
        }
        const Icon = item.icon!
        return (
          <Link
            key={item.href}
            href={item.href!}
            onClick={onNavigate}
            className={cn(base, 'text-text/80 hover:bg-primary-light/50 hover:text-text')}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning text-white text-xs font-bold leading-none">
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}

      {/* Log out */}
      <div className="my-1 border-t border-border" />
      <button
        onClick={handleLogout}
        className={cn(base, 'text-warning hover:bg-warning/10')}
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Log Out
      </button>
    </>
  )
}
