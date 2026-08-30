import Link from 'next/link'
import { Cake, Sparkles, PenLine, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { ContactMethodRow } from '@/components/features/ContactMethodRow'
import { formatBirthday } from '@/lib/birthday'
import type { ContactMethodType } from '@/lib/database.types'

interface PublicProfileUser {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  birthday_month: number | null
  birthday_day: number | null
  birthday_year: number | null
}

interface ContactMethod {
  id: string
  type: ContactMethodType
  value: string
}

interface PublicProfileClientProps {
  user: PublicProfileUser
  contactMethods: ContactMethod[]
  isOwnProfile: boolean
}

function NotShared({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text/50 italic">{children}</p>
}

export function PublicProfileClient({ user, contactMethods, isOwnProfile }: PublicProfileClientProps) {
  const birthday = formatBirthday(user.birthday_month, user.birthday_day, user.birthday_year)
  const bio = user.bio?.trim()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Hero / user badge */}
      <div className="card shadow-sm overflow-hidden p-0">
        <div className="relative bg-gradient-to-r from-primary/20 via-accent/15 to-secondary/20 px-5 pt-8 pb-14">
          <Sparkles className="absolute top-3 right-4 w-5 h-5 text-primary/40" />
          <Star className="absolute top-8 right-14 w-3 h-3 text-accent/50" />
          <Sparkles className="absolute bottom-3 left-6 w-4 h-4 text-secondary/40" />
        </div>
        <div className="px-5 pb-5 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
          <Avatar
            avatarUrl={user.avatar_url}
            displayName={user.display_name}
            size={88}
            clickable
            className="ring-4 ring-card"
          />
          <div className="flex-1 min-w-0 sm:pb-1">
            <h1 className="font-accent text-2xl font-bold text-text truncate">
              {user.display_name ?? 'User'}
            </h1>
            <p className="text-xs text-text/50">WDWShiftX Profile</p>
          </div>
          {isOwnProfile && (
            <Link
              href="/profile?tab=public"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0 sm:pb-1"
            >
              <PenLine className="w-4 h-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* Birthday */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
            <Cake className="w-4 h-4 text-accent" />
          </div>
          <h2 className="font-accent font-bold text-text">Birthday</h2>
        </div>
        {birthday
          ? <p className="text-sm text-text">{birthday}</p>
          : <NotShared>This user hasn&rsquo;t shared their birthday.</NotShared>}
      </div>

      {/* Bio */}
      <div className="card shadow-sm">
        <h2 className="font-accent font-bold text-text mb-3">About</h2>
        {bio
          ? <p className="text-sm text-text whitespace-pre-wrap">{bio}</p>
          : <NotShared>This user hasn&rsquo;t shared a bio.</NotShared>}
      </div>

      {/* Contact methods */}
      <div className="card shadow-sm">
        <h2 className="font-accent font-bold text-text mb-3">Contact</h2>
        {contactMethods.length > 0 ? (
          <div className="space-y-3">
            {contactMethods.map(c => (
              <ContactMethodRow key={c.id} type={c.type} value={c.value} />
            ))}
          </div>
        ) : (
          <NotShared>This user hasn&rsquo;t shared any contact info.</NotShared>
        )}
      </div>
    </div>
  )
}
