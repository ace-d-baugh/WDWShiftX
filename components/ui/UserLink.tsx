import Link from 'next/link'
import { cn } from '@/lib/utils'

interface UserLinkProps {
  userId: string | null | undefined
  displayName: string | null | undefined
  currentUserId?: string | null
  className?: string
  children?: React.ReactNode
}

/**
 * Links a name/avatar to the right profile: the viewer's own /profile
 * settings page when it's their own name, otherwise the target user's public
 * /users/[id] page. Renders plain (non-linked) text when userId is missing —
 * covers denormalized rows from a since-removed user.
 */
export function UserLink({ userId, displayName, currentUserId, className, children }: UserLinkProps) {
  const content = children ?? displayName ?? 'Unknown'

  if (!userId) {
    return <span className={className}>{content}</span>
  }

  const href = userId === currentUserId ? '/profile' : `/users/${userId}`

  return (
    <Link href={href} className={cn('hover:text-primary hover:underline transition-colors', className)}>
      {content}
    </Link>
  )
}
