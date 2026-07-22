import { requireAdmin } from '@/lib/auth/session'
import { KanbanClient } from './KanbanClient'
import type { RoadmapColumn } from '@/lib/database.types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Roadmap' }

export default async function KanbanPage() {
  const { supabase } = await requireAdmin()

  const { data: cards } = await supabase
    .from('roadmap_cards')
    .select('id, title, description, column_key, position')
    .order('column_key')
    .order('position')

  return (
    <KanbanClient
      initialCards={(cards ?? []) as {
        id: string
        title: string
        description: string | null
        column_key: RoadmapColumn
        position: number
      }[]}
    />
  )
}
