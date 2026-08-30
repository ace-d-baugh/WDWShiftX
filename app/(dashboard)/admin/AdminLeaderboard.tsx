'use client'

import { useEffect, useState } from 'react'
import { Trophy, HeartHandshake as Handshake, Frown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { UserLink } from '@/components/ui/UserLink'

interface LeaderboardRow {
  category: 'posts' | 'reliable' | 'disappointing'
  user_id: string
  display_name: string | null
  cnt: number
  rank: number
}

interface AdminLeaderboardProps {
  boards: { id: string; name: string }[]
  currentUserId: string
}

const MEDAL = ['🏆', '🥈', '🥉'] as const

const CATEGORIES: { key: LeaderboardRow['category']; title: string; icon: React.ComponentType<{ className?: string }>; color: string; unit: string }[] = [
  { key: 'posts', title: 'Most Shift Posts', icon: Trophy, color: 'text-primary', unit: 'posted' },
  { key: 'reliable', title: 'Most Reliable', icon: Handshake, color: 'text-success', unit: 'completed' },
  { key: 'disappointing', title: 'Most Disappointing', icon: Frown, color: 'text-warning', unit: 'fell through' },
]

function CategoryCard({ title, icon: Icon, color, unit, rows, currentUserId }: {
  title: string; icon: React.ComponentType<{ className?: string }>; color: string; unit: string; rows: LeaderboardRow[]; currentUserId: string
}) {
  return (
    <div className="card">
      <h3 className="font-accent font-bold text-text mb-3 flex items-center gap-1.5">
        <Icon className={cn('w-4 h-4', color)} /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text/40 italic text-center py-8">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(r => (
            <li
              key={r.user_id}
              className={cn(
                'flex items-center gap-2 text-sm px-2 py-1.5 rounded-md',
                r.rank === 1 ? 'font-bold text-text bg-primary-light/40' : 'text-text/80'
              )}
            >
              <span className="w-5 shrink-0 text-text/40 text-xs">{r.rank}.</span>
              {r.rank <= 3 && <span className="shrink-0">{MEDAL[r.rank - 1]}</span>}
              <UserLink userId={r.user_id} displayName={r.display_name ?? 'A board member'} currentUserId={currentUserId} className="flex-1 min-w-0 truncate" />
              <span className="shrink-0 text-text/50 text-xs">{r.cnt} {unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminLeaderboard({ boards, currentUserId }: AdminLeaderboardProps) {
  const supabase = createClient()
  const [boardId, setBoardId] = useState('')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_leaderboard_admin', { p_board_id: boardId || null })
      .then(({ data }) => {
        if (!cancelled) { setRows((data as LeaderboardRow[]) ?? []); setLoading(false) }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  const byCategory = (key: LeaderboardRow['category']) =>
    rows.filter(r => r.category === key).sort((a, b) => a.rank - b.rank)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text/60">Board</span>
          <select
            className="input text-sm h-9 max-w-xs"
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
          >
            <option value="">All Boards</option>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {loading && <Loader2 className="w-4 h-4 text-text/40 animate-spin" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {CATEGORIES.map(c => (
          <CategoryCard key={c.key} title={c.title} icon={c.icon} color={c.color} unit={c.unit} rows={byCategory(c.key)} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  )
}
