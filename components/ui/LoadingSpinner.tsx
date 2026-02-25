import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export function LoadingSpinner({ size = 'md', className, label = 'Loading...' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)} role="status" aria-label={label}>
      <span
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizes[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  )
}
