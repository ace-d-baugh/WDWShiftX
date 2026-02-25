import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>((
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref
) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-secondary text-text hover:bg-secondary/80',
    outline: 'border border-primary text-primary hover:bg-primary-light',
    ghost: 'text-text hover:bg-primary-light',
    danger: 'bg-warning text-white hover:bg-warning/90',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[44px]',
    lg: 'px-6 py-3 text-base min-h-[48px]',
  }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
      {children}
    </button>
  )
})
Button.displayName = 'Button'
export { Button }
