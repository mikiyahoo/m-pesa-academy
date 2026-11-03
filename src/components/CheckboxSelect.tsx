import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

export type CheckboxOption = { id: string; label: string; hint?: string }

/** A dropdown with a checkbox per option, a search box for long lists, and Clear / Done. */
export function CheckboxSelect({
  options,
  selected,
  onChange,
  placeholder,
  noun,
  invalid,
}: {
  options: CheckboxOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  /** Plural word for the summary, e.g. "groups". */
  noun: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc, true)
    }
  }, [open])
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const label = !selected.length ? placeholder : selected.length === 1 ? (options.find((o) => o.id === selected[0])?.label ?? `1 ${noun}`) : `${selected.length} ${noun} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          invalid ? 'border-brand-500' : 'border-zinc-200',
        )}
      >
        <span className={cn('truncate', selected.length ? 'text-zinc-900' : 'text-zinc-400')}>{label}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          {options.length > 6 && (
            <div className="border-b border-zinc-100 p-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${noun}…`}
                autoFocus
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          )}
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {shown.map((o) => {
              const checked = selected.includes(o.id)
              return (
                <li key={o.id}>
                  <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition', checked ? 'bg-brand-50/60' : 'hover:bg-zinc-50')}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} className="size-4 shrink-0 accent-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{o.label}</span>
                      {o.hint && <span className="block truncate text-xs text-zinc-500">{o.hint}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
            {!shown.length && <li className="px-2.5 py-3 text-sm text-zinc-500">No {noun} match “{q}”.</li>}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs">
            <span className="text-zinc-500">{selected.length} selected</span>
            <span className="flex gap-3">
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="font-semibold text-zinc-600 hover:text-zinc-900">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="font-semibold text-brand-600 hover:text-brand-700">
                Done
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
