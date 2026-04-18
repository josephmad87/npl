import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export type BackNavLinkProps = {
  /** Route path (may include `$param` segments). */
  to: string
  params?: Record<string, string | number | undefined>
  search?: Record<string, unknown>
  replace?: boolean
  className?: string
  children: ReactNode
}

/**
 * Ghost back control with a leading arrow (replaces “← …” text-only links).
 */
export function BackNavLink({
  className,
  children,
  to,
  params,
  search,
  replace,
}: BackNavLinkProps) {
  return (
    <Link
      to={to as never}
      params={params as never}
      search={search as never}
      replace={replace}
      className={['btn-ghost', 'btn--with-icon', className]
        .filter(Boolean)
        .join(' ')}
    >
      <ArrowLeft size={18} strokeWidth={2} aria-hidden />
      {children}
    </Link>
  )
}
