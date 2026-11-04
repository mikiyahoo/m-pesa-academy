import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

/**
 * Styled replacements for the browser's own dropdown and date picker. They keep the native
 * call shape — `value` plus `onChange(e)` reading `e.target.value` — so screens swap them in
 * without other changes. Menus open in a layer above the page so cards and pop-ups don't clip them.
 */

type ChangeLike = { target: { value: string }; currentTarget: { value: string } }
const changeEvent = (value: string): ChangeLike => ({ target: { value }, currentTarget: { value } })

/** Places a floating panel under (or above) its button and keeps it there while the page scrolls. */
function useAnchor(open: boolean, anchor: React.RefObject<HTMLElement | null>, panelHeight: number) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom
      const up = below < panelHeight + 12 && r.top > below
      setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, panelHeight])
  return pos
}

/** Closes on a click outside both the button and the panel, and on Escape. */
function useDismiss(open: boolean, close: () => void, ...refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => !refs.some((r) => r.current?.contains(e.target as Node)) && close()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), close())
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', esc, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : ''))
    .join('')

type Opt = { value: string; label: string; disabled?: boolean }

/** Reads <option> children (also inside fragments and arrays) into a flat list. */
function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = []
  const walk = (n: ReactNode) =>
    Children.forEach(n, (c) => {
      if (!isValidElement(c)) return
      const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>
      if (el.type === 'option') {
        const label = textOf(el.props.children)
        out.push({ value: el.props.value !== undefined ? String(el.props.value) : label, label, disabled: el.props.disabled })
      } else walk(el.props.children)
    })
  walk(children)
  return out
}

export type SelectMenuProps = {
  value?: string | number | readonly string[]
  onChange?: (e: ChangeLike) => void
  children?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  title?: string
}

/** Dropdown with our own list: check on the chosen option, arrow keys, type-to-jump. */
export function SelectMenu({ value, onChange, children, disabled, className, id, title, 'aria-invalid': ariaInvalid, ...rest }: SelectMenuProps) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value ?? options[0]?.value ?? '')
  const selected = options.find((o) => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const listHeight = Math.min(288, options.length * 38 + 8)
  const pos = useAnchor(open, button, listHeight)
  useDismiss(open, () => setOpen(false), button, panel)
  const typed = useRef({ text: '', at: 0 })

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.value === current)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (o: Opt) => {
    if (o.disabled) return
    setOpen(false)
    if (o.value !== current) onChange?.(changeEvent(o.value))
    button.current?.focus()
  }
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < options.length; i += by) if (!options[i].disabled) return i
    return from
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => step(a, 1)))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => step(a, -1)))
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), options[active] && choose(options[active]))
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={rest['aria-label']}
        aria-invalid={ariaInvalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-left text-sm text-zinc-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
          open ? 'border-brand-500 ring-2 ring-brand-100' : 'border-zinc-200 hover:border-zinc-300',
          className,
        )}
      >
        <span className={cn('min-w-0 truncate', !selected?.value && 'text-zinc-500')}>{selected?.label ?? ''}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition', open && 'rotate-180 text-brand-600')} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="listbox"
            onKeyDown={onKey}
            style={{ position: 'fixed', left: Math.min(pos.left, window.innerWidth - Math.max(pos.width, 260) - 8), minWidth: Math.max(pos.width, 260), width: 'max-content', maxWidth: Math.max(pos.width, Math.min(420, window.innerWidth - 16)), ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className="z-[90] max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-surface p-1 shadow-xl scrollbar-thin"
          >
            {options.map((o, i) => {
              const on = o.value === current
              return (
                <div
                  key={`${o.value}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={on}
                  aria-disabled={o.disabled}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
                    o.disabled ? 'cursor-default text-zinc-400' : i === active ? 'bg-brand-50 text-brand-800' : 'text-zinc-800',
                    on && 'font-semibold',
                  )}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {on && <Check className="size-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromISO = (s?: string) => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const addDays = (base: Date, days: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
  return toISO(d)
}
const addMonths = (base: Date, months: number) => {
  const d = new Date(base.getFullYear(), base.getMonth() + months, base.getDate())
  const expectedMonth = (base.getMonth() + months) % 12
  const normalizedExpected = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth
  if (d.getMonth() !== normalizedExpected) {
    return toISO(new Date(base.getFullYear(), base.getMonth() + months + 1, 0))
  }
  return toISO(d)
}
const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export type DatePickerProps = {
  value?: string
  onChange?: (e: ChangeLike) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
  placeholder?: string
  id?: string
  'aria-label'?: string
  onFocus?: () => void
}

/** Date field with our own month calendar: red selected day, today ringed, Today / Clear shortcuts. */
export function DatePicker({ value, onChange, min, max, disabled, className, placeholder = 'Pick a date', id, onFocus, ...rest }: DatePickerProps) {
  const selected = fromISO(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => selected ?? new Date())
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const pos = useAnchor(open, button, 340)
  useDismiss(open, () => setOpen(false), button, panel)
  useEffect(() => {
    if (open) setView(selected ?? fromISO(min) ?? new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const today = toISO(new Date())
  const presets = useMemo(() => {
    const now = new Date()
    return [
      { label: 'Week', iso: addDays(now, 7), title: `1 week from today (${addDays(now, 7)})` },
      { label: 'Month', iso: addMonths(now, 1), title: `1 month from today (${addMonths(now, 1)})` },
      { label: '3 Months', iso: addMonths(now, 3), title: `3 months from today (${addMonths(now, 3)})` },
    ]
  }, [])
  const year = view.getFullYear()
  const month = view.getMonth()
  const first = new Date(year, month, 1)
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1))]
  while (cells.length % 7) cells.push(null)
  const blocked = (iso: string) => (!!min && iso < min) || (!!max && iso > max)
  const pick = (iso: string) => {
    if (blocked(iso)) return
    onChange?.(changeEvent(iso))
    setOpen(false)
    button.current?.focus()
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={rest['aria-label']}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (onFocus?.(), setOpen((o) => !o))}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-left text-sm text-zinc-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400',
          open ? 'border-brand-500 ring-2 ring-brand-100' : 'border-zinc-200 hover:border-zinc-300',
          className,
        )}
      >
        <Calendar className={cn('size-4 shrink-0', disabled ? 'text-zinc-300' : 'text-brand-600')} aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-zinc-400')}>
          {selected ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Choose a date"
            style={{ position: 'fixed', left: Math.min(pos.left, window.innerWidth - 320), ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className="z-[90] w-[304px] rounded-2xl border border-zinc-200 bg-surface p-3 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm font-bold text-zinc-900">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-400">
              {WEEK.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />
                const iso = toISO(d)
                const on = iso === value
                const off = blocked(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={off}
                    onClick={() => pick(iso)}
                    aria-pressed={on}
                    aria-label={d.toDateString()}
                    className={cn(
                      'grid aspect-square place-items-center rounded-lg text-sm transition',
                      on ? 'bg-brand-600 font-bold text-white shadow-sm shadow-brand-600/30' : off ? 'text-zinc-300' : 'text-zinc-800 hover:bg-brand-50 hover:text-brand-700',
                      !on && iso === today && 'font-bold text-brand-600 ring-1 ring-brand-300 ring-inset',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-xs font-semibold">
              <div className="flex items-center gap-1">
                {presets.map((p) => {
                  const off = blocked(p.iso)
                  const on = p.iso === value
                  return (
                    <button
                      key={p.label}
                      type="button"
                      disabled={off}
                      title={p.title}
                      onClick={() => pick(p.iso)}
                      className={cn(
                        'rounded-lg px-2 py-1 transition',
                        on
                          ? 'bg-brand-50 font-bold text-brand-700 ring-1 ring-brand-300'
                          : 'text-brand-600 hover:bg-brand-50 disabled:text-zinc-300 disabled:hover:bg-transparent',
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              {value && (
                <button
                  type="button"
                  onClick={() => (onChange?.(changeEvent('')), setOpen(false))}
                  className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
