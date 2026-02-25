'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Calendar, MapPin, Briefcase, User, Flag, Edit, EyeOff, Mail, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FlagModal } from '@/components/features/FlagModal'
import { cn } from '@/lib/utils'
import type { PreferredTime } from '@/lib/database.types'

const timeLabels: Record<PreferredTime, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  late: 'Late Night',
}

const timeBadgeVariant: Record<PreferredTime, string> = {
  morning: 'bg-accent/20 text-text',
  afternoon: 'bg-info/20 text-info',
  evening: 'bg-primary/20 text-primary',
  late: 'bg-text/10 text-text',
}

export interface RequestData {
  id: string
  created_by: string
  user_id: string | null
  property_name: string
  location_name: string
  role_name: string
  preferred_times: PreferredTime[]
  requested_date: string
  comments: string | null
  is_active: boolean
  expires_at: string
  created_at: string
}

interface RequestCardProps {
  request: RequestData
  currentUserId?: string
  currentUserName?: string
  onDeactivate?: (id: string) => void
  onEdit?: (request: RequestData) => void
}

export function RequestCard({ request, currentUserId, currentUserName, onDeactivate, onEdit }: RequestCardProps) {
  const [flagOpen, setFlagOpen] = useState(false)

  const isOwner = currentUserId && request.user_id === currentUserId

  const formattedDate = (() => {
    try {
      return format(parseISO(request.requested_date), 'EEEE, MMMM d, yyyy')
    } catch {
      return request.requested_date
    }
  })()

  return (
    <>
      <div className="card hover:shadow-md transition-shadow border-l-4 border-l-accent">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-accent font-bold text-text text-base leading-tight">
              Shift Wanted
            </h3>
            <p className="text-xs text-text/50 mt-0.5 flex items-center gap-1">
              <User className="w-3 h-3" />
              Requested by {request.created_by}
            </p>
          </div>
          <span className="badge bg-accent/20 text-text shrink-0">Request</span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm text-text/70">
            <Calendar className="w-4 h-4 text-accent shrink-0" />
            <span className="font-medium text-text">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text/70">
            <MapPin className="w-4 h-4 text-accent shrink-0" />
            <span className="truncate">{request.property_name} &rsaquo; {request.location_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text/70">
            <Briefcase className="w-4 h-4 text-accent shrink-0" />
            <span>{request.role_name}</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-text/70">
            <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {request.preferred_times.map(t => (
                <span key={t} className={cn('badge text-xs', timeBadgeVariant[t])}>
                  {timeLabels[t]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {request.comments && (
          <p className="text-sm text-text/60 bg-accent/10 rounded-md px-3 py-2 mb-3 italic">
            &ldquo;{request.comments}&rdquo;
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text/40">
            Expires at end of day
          </span>
          <div className="flex items-center gap-1.5">
            {isOwner ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(request)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8"
                >
                  <Edit className="w-3 h-3" /> Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDeactivate?.(request.id)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8"
                >
                  <EyeOff className="w-3 h-3" /> Remove
                </Button>
              </>
            ) : (
              <>
                <a
                  href={`mailto:?subject=Re: Shift Request on WDWShiftX&body=Hi ${request.created_by},%0A%0AI saw your shift request on WDWShiftX and I have a shift available!%0A%0A- ${currentUserName ?? 'A Cast Member'}`}
                  className="btn btn-primary text-xs px-3 py-1 min-h-0 h-8 gap-1 no-underline inline-flex items-center rounded-md"
                >
                  <Mail className="w-3 h-3" /> Contact
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlagOpen(true)}
                  className="gap-1 text-xs px-2 py-1 min-h-0 h-8 text-text/40 hover:text-warning"
                  aria-label="Flag request"
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
        targetId={request.id}
      />
    </>
  )
}
