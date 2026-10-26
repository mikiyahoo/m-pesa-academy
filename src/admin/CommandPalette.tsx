import { Empty } from './ui'
import { BookOpen, CornerDownLeft, FileText, GraduationCap, LayoutGrid, Search, SearchX, User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useAdmin } from './store'

type Item = { id: string; label: string; hint: string; to: string; icon: typeof Search }

const pages: [string, string][] = [
  ['Dashboard', '/admin'],
  ['Trainings', '/admin/trainings'],
  ['Training Requests', '/admin/requests'],
  ['Calendar', '/admin/trainings?view=calendar'],
  ['Categories', '/admin/categories'],
  ['Journeys', '/admin/journeys'],
  ['Materials', '/admin/materials'],
  ['Feedback Forms', '/admin/feedback/forms'],
  ['Feedback Responses', '/admin/feedback/responses'],
  ['Pre-Assessments', '/admin/assessments/pre'],
  ['Post-Assessments', '/admin/assessments/post'],
  ['Submissions', '/admin/submissions'],
  ['Certificate Templates', '/admin/certificate-templates'],
  ['Users', '/admin/users'],
  ['Users · Temporary access', '/admin/temporary-access'],
  ['Groups', '/admin/groups'],
  ['Training Types', '/admin/training-types'],
  ['Audit Logs', '/admin/audit-logs'],
  ['Reports', '/admin/reports'],
]

/** Ctrl/⌘+K quick search across pages, trainings, journeys, materials and users. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useAdmin()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...pages.map(([label, to]) => ({ id: `p${to}`, label, hint: 'Page', to, icon: LayoutGrid })),
      ...data.trainings.map((t) => ({ id: t.id, label: t.name, hint: 'Training', to: `/admin/trainings/${t.id}`, icon: GraduationCap })),
      ...data.journeys.map((j) => ({ id: j.id, label: j.name, hint: 'Journey', to: `/admin/journeys/${j.id}`, icon: BookOpen })),
      ...data.materials.map((m) => ({ id: m.id, label: m.title, hint: 'Material', to: '/admin/materials', icon: FileText })),
      ...data.people.map((p) => ({ id: p.id, label: p.name, hint: p.email, to: '/admin/users', icon: User })),
    ]
    const term = q.trim().toLowerCase()
    return (term ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(term)) : all.slice(0, 8)).slice(0, 12)
  }, [data, q])

  if (!open) return null

  const go = (item?: Item) => {
    if (!item) return
    navigate(item.to)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal aria-label="Quick search" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4">
          <Search className="size-4 text-zinc-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') go(items[active])
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="Search trainings, users, pages…"
            className="h-12 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm', i === active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700')}
              >
                <item.icon className="size-4 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="max-w-[40%] truncate text-xs text-zinc-500">{item.hint}</span>
                {i === active && <CornerDownLeft className="size-3.5 text-zinc-400" />}
              </button>
            </li>
          ))}
          {!items.length && (
            <li>
              <Empty compact icon={SearchX} title={`No results for “${q}”`} text="Try a training, person or page name." />
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
