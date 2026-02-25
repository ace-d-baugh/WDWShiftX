'use client'

import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { Clock, MapPin, Briefcase, User, Flag, Edit, EyeOff, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FlagModal } from '@/components/features/FlagModal'
import { cn } from '@/lib/utils'

const ET = 'America/New_York'

export interface ShiftData {
  id: string
  shift_title: string
  created_by: string
  user_id: string | null
  property_name: string
  location_name: string
  role_name: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  comments: string | null
  is_active: boolean
  expires_at: string
  created_at: string
}

interface ShiftCardProps {
  shift: ShiftData
  currentUserId?: string
  currentUserName?: string
  onDeactivate?: (id: string) => void
  onEdit?: (shift: ShiftData) => void
}

export function ShiftCard({ shift, currentUserId, currentUserName, onDeactivate, onEdit }: ShiftCardProps) {
  const [flagOpen, setFlagOpen] = useState(false)

  const isOwner = currentUserId && shift.user_id === currentUserId

  const formatTime = (iso: string) =>
    formatInTimeZone(parseISO(iso), ET, 'MMM d, yyyy h:mm a zzz')

  const expiresIn = () => {
    const exp = parseISO(shift.expires_at)
    if (exp <= new Date()) return 'Expired'
    return `Expires ${formatDistanceToNow(exp, { addSuffix: true })}`
  }

  const duration = () => {
    const start = parseISO(shift.start_time)
    const end = parseISO(shift.end_time)
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <>
      <div className={cn(
        'card hover:shadow-md transition-shadow border-l-4',
        shift.is_trade && shift.is_giveaway ? 'border-l-primary' :
        shift.is_trade ? 'border-l-info' : 'border-l-success'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-accent font-bold text-text text-base leading-tight truncate">
              {shift.shift_title}
            </h3>
            <p className="text-xs text-text/50 mt-0.5 flex items-center gap-1">
              <User className="w-3 h-3" />
              Posted by {shift.created_by}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {shift.is_trade && <Badge variant="trade">Trade</Badge>}
            {shift.is_giveaway && <Badge variant="giveaway">Giveaway</Badge>}
            {shift.is_overtime_approved && <Badge variant="ot">OT</Badge>}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-sm text-text/70">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{shift.property_name} &rsaquo; {shift.location_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text/70">
            <Briefcase className="w-4 h-4 text-primary shrink-0" />
            <span>{shift.role_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text/70">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <div>{formatTime(shift.start_time)}</div>
              <div className="text-xs text-text/50">to {formatInTimeZone(parseISO(shift.end_time), ET, 'h:mm a')} &bull; {duration()}</div>
            </div>
          </div>
        </div>

        {shift.comments && (
          <p className="text-sm text-text/60 bg-primary-light/50 rounded-md px-3 py-2 mb-4 italic">
            &ldquo;{shift.comments}&rdquo;
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text/40">{expiresIn()}</span>
          <div className="flex items-center gap-1.5">
            {isOwner ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(shift)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8"
                >
                  <Edit className="w-3 h-3" /> Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDeactivate?.(shift.id)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8"
                >
                  <EyeOff className="w-3 h-3" /> Remove
                </Button>
              </>
            ) : (
              <>
                <a
                  href={`mailto:?subject=Re: ${encodeURIComponent(shift.shift_title)} on WDWShiftX&body=Hi ${shift.created_by},%0A%0AI saw your shift post on WDWShiftX and I'm interested!%0A%0A- ${currentUserName ?? 'A Cast Member'}`}
                  className="btn btn-primary text-xs px-3 py-1 min-h-0 h-8 gap-1 no-underline inline-flex items-center rounded-md"
                >
                  <Mail className="w-3 h-3" /> Contact
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlagOpen(true)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8 text-text/40 hover:text-warning"
                  aria-label="Flag post"
                >
                  <Flag className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <FlagModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        targetType="post"
        targetId={shift.id}
      />
    </>
  )
}
