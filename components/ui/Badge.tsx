import { cn } from '@/lib/utils'

type BadgeVariant = 'trade' | 'giveaway' | 'ot' | 'pending' | 'leader' | 'copro' | 'admin' | 'cast'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    trade: 'badge badge-trade',
    giveaway: 'badge badge-giveaway',
    ot: 'badge badge-ot',
    pending: 'badge bg-accent/20 text-text',
    leader: 'badge bg-primary/20 text-primary',
    copro: 'badge bg-info/20 text-info',
    admin: 'badge bg-warning/20 text-warning',
    cast: 'badge bg-secondary/40 text-text',
  }
  return <span className={cn(variants[variant], className)}>{children}</span>
}
