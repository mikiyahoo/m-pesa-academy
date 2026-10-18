import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

/** The portal's one empty state: red icon tile, bold title, one line of help, optional action. */
export function EmptyState({ icon: Icon, title, text, action, compact = false, className }: { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <span className={cn('grid place-items-center rounded-2xl bg-brand-50 text-brand-600', compact ? 'size-11' : 'size-14')}>
        <Icon className={compact ? 'size-5' : 'size-7'} />
      </span>
      <p className={cn('font-bold text-zinc-900', compact ? 'mt-3 text-sm' : 'mt-4 text-base')}>{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
