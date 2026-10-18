import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

/** A link (`to`) or an action (`onClick`); `danger` styles destructive actions. */
export type RowMenuItem = { label: string; icon: LucideIcon; to?: string; onClick?: () => void; primary?: boolean; danger?: boolean }

/**
 * Three-dot menu for a table row. The list is fixed-positioned from the button, so it isn't
 * clipped by a horizontally scrolling table; it closes on outside click, Escape, scroll or resize.
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (e.type === 'mousedown' && (menu.current?.contains(e.target as Node) || button.current?.contains(e.target as Node))) return
      setPos(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [pos])

  const toggle = () => {
    if (pos) return setPos(null)
    const r = button.current!.getBoundingClientRect()
    // Open upwards when there isn't room below.
    const below = window.innerHeight - r.bottom > items.length * 40 + 24
    setPos({ top: below ? r.bottom + 6 : r.top - 6 - (items.length * 38 + 12), right: window.innerWidth - r.right })
  }

  return (
    <>
      <button
        ref={button}
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className={cn('grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900', pos && 'bg-zinc-100 text-zinc-900')}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {pos && (
        <div ref={menu} role="menu" className="fixed z-50 w-48 rounded-xl border border-zinc-200 bg-surface p-1.5 shadow-xl" style={{ top: pos.top, right: pos.right }}>
          {items.map((i) => {
            const cls = cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition hover:bg-zinc-100',
              i.danger ? 'text-brand-700 hover:bg-brand-50' : i.primary ? 'text-brand-600' : 'text-zinc-700',
            )
            const body = (
              <>
                <i.icon className="size-4 shrink-0" /> {i.label}
              </>
            )
            return i.to ? (
              <Link key={i.label} to={i.to} role="menuitem" onClick={() => setPos(null)} className={cls}>
                {body}
              </Link>
            ) : (
              <button
                key={i.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null)
                  i.onClick?.()
                }}
                className={cls}
              >
                {body}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
