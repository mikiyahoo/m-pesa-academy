import { Building2, Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { useAdmin } from './store'
import { Input } from './ui'

/** Always offered, even before any group uses them. */
const DEFAULT_ORGANIZATIONS = ['Safaricom Ethiopia', 'M-PESA Ethiopia']

/** Every organization already used on groups and people, plus the company defaults. */
export function useOrganizations() {
  const { data } = useAdmin()
  return useMemo(() => {
    const seen = new Map<string, string>()
    for (const name of [...DEFAULT_ORGANIZATIONS, ...data.groups.map((g) => g.organization), ...data.people.map((p) => p.organization)]) {
      const clean = name?.trim()
      if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [data.groups, data.people])
}

/**
 * Organization picker: choose a known organization from the list, or type a new name and add it.
 * New names are saved with the record that uses them, so they show up here next time.
 */
export function OrganizationInput({ value, onChange, placeholder = 'Choose or type an organization', invalid, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; autoFocus?: boolean }) {
  const all = useOrganizations()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  // While browsing (not typing), show the whole list; when typing, filter it.
  const matches = typed && q ? all.filter((o) => o.toLowerCase().includes(q)) : all
  const exact = all.some((o) => o.toLowerCase() === q)
  const canAdd = typed && !!q && !exact
  const options = [...matches.map((o) => ({ label: o, add: false })), ...(canAdd ? [{ label: value.trim(), add: true }] : [])]

  // Fixed position so the list isn't clipped by a scrolling pop-up body.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  useEffect(() => {
    if (!open) return
    const place = () => {
      const box = ref.current?.getBoundingClientRect()
      if (!box) return
      const up = window.innerHeight - box.bottom < 270 && box.top > 270
      setPos(up ? { left: box.left, width: box.width, bottom: window.innerHeight - box.top + 6 } : { left: box.left, width: box.width, top: box.bottom + 6 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (label: string) => {
    onChange(label)
    setTyped(false)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <Building2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
      <Input
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setTyped(true)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open && options[active]) {
            e.preventDefault()
            pick(options[active].label)
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={cn('pr-9 pl-9', invalid && 'border-brand-500 ring-1 ring-brand-500')}
      />
      <button type="button" tabIndex={-1} aria-label="Show organizations" onMouseDown={(e) => e.preventDefault()} onClick={() => (setTyped(false), setOpen((o) => !o))} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
        <ChevronDown className={cn('size-4 transition', open && 'rotate-180 text-brand-600')} />
      </button>
      {open && pos && options.length > 0 && (
        <ul role="listbox" style={{ position: 'fixed', ...pos }} className="z-[90] max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-surface p-1 shadow-xl scrollbar-thin">
          {options.map((o, i) => (
            <li key={`${o.add ? 'add-' : ''}${o.label}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.label)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition', i === active ? 'bg-brand-50/70 text-brand-700' : 'text-zinc-800 hover:bg-zinc-50', o.add && 'border-t border-zinc-100 font-semibold text-brand-600')}
              >
                {o.add ? <Plus className="size-4 shrink-0" /> : <Building2 className="size-4 shrink-0 text-zinc-400" />}
                <span className="min-w-0 flex-1 truncate">{o.add ? `Add “${o.label}”` : o.label}</span>
                {!o.add && o.label.toLowerCase() === q && <Check className="size-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
