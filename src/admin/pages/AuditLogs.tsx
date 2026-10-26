import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, Download, FileClock, PlusCircle, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DateRangePicker } from '../../components/DateRangePicker'
import { cn } from '../../lib/utils'
import { auditActionCategory, auditEntityType, AUDIT_ACTION_CATEGORIES, AUDIT_ENTITY_TYPES, resolveAuditEntity } from '../audit'
import { dateTime } from '../helpers'
import { useAdmin } from '../store'
import type { AuditLog } from '../types'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Modal, PageHeader, SearchInput, Select, Table } from '../ui'
import { isInRange, type DateRange } from '../reports/filters'

type FilterMenuProps = {
  label: string
  options: readonly string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function FilterMenu({ label, options, selected, onChange }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (option: string) => {
    const next = new Set(selected)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-surface px-3 text-xs font-semibold text-zinc-700 transition hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      >
        <PlusCircle className="size-3.5 text-brand-600" />
        {label}
        {selected.size > 0 && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">{selected.size}</span>}
        <ChevronDown className={cn('size-3.5 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="dialog" aria-label={`${label} filter`} className="absolute left-0 z-40 mt-2 w-64 rounded-xl border border-zinc-200 bg-surface p-2 shadow-xl">
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={label}
              aria-label={`Search ${label.toLowerCase()}`}
              className="w-full rounded-lg border border-zinc-200 bg-surface py-1.5 pr-2 pl-8 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleOptions.length ? visibleOptions.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={selected.has(option)}
                  onChange={() => toggle(option)}
                  className="size-3.5 accent-brand-600"
                />
                {option}
              </label>
            )) : <p className="px-2 py-3 text-xs text-zinc-500">No matches</p>}
          </div>
          {selected.size > 0 && (
            <button type="button" onClick={() => onChange(new Set())} className="mt-1 w-full border-t border-zinc-100 px-2 pt-2 text-left text-xs font-semibold text-brand-700 hover:text-brand-800">
              Clear {label.toLowerCase()} filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type ColumnKey = 'user' | 'action' | 'entityType' | 'remarks' | 'changes'
const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: 'user', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'entityType', label: 'Entity type' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'changes', label: 'Change details' },
]

function ViewMenu({ visible, onChange, compact, onCompactChange }: {
  visible: Record<ColumnKey, boolean>
  onChange: (key: ColumnKey, value: boolean) => void
  compact: boolean
  onCompactChange: (value: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-surface px-3 text-xs font-semibold text-zinc-700 transition hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      >
        <SlidersHorizontal className="size-4 text-zinc-600" /> View <ChevronDown className={cn('size-3.5 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="dialog" aria-label="Table view options" className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-zinc-200 bg-surface p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Show columns</p>
          <div className="space-y-1">
            {COLUMN_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                <input type="checkbox" checked={visible[key]} onChange={(event) => onChange(key, event.target.checked)} className="size-3.5 accent-brand-600" />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-2 border-t border-zinc-100 pt-2">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Row density</p>
            <div className="grid grid-cols-2 gap-1">
              {[false, true].map((value) => (
                <button key={String(value)} type="button" aria-pressed={compact === value} onClick={() => onCompactChange(value)} className={cn('rounded-lg px-2 py-1.5 text-xs', compact === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-zinc-600 hover:bg-zinc-50')}>
                  {value ? 'Compact' : 'Comfortable'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ACTION_TONES: Record<string, 'green' | 'red' | 'amber' | 'zinc'> = {
  Create: 'green',
  Update: 'zinc',
  Delete: 'red',
  Approve: 'green',
  Reject: 'red',
  Cancel: 'amber',
  Reschedule: 'amber',
  'Status Change': 'zinc',
  Invite: 'zinc',
}

function ChangeDetails({ log, entityId, onClose }: { log: AuditLog; entityId: string; onClose: () => void }) {
  const changes = log.changes ?? []
  return (
    <Modal open wide onClose={onClose} title="Audit log details" description={`${auditEntityType(log)} · ${log.target}`}>
      <div className="grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="text-xs text-zinc-500">User</span><p className="mt-0.5 font-medium text-zinc-900">{log.actor}</p></div>
        <div><span className="text-xs text-zinc-500">Timestamp</span><p className="mt-0.5 font-medium text-zinc-900">{dateTime(log.at)}</p></div>
        <div><span className="text-xs text-zinc-500">Action</span><p className="mt-0.5 font-medium text-zinc-900">{log.action}</p></div>
        <div><span className="text-xs text-zinc-500">Entity ID</span><p className="mt-0.5 break-all font-mono text-xs text-zinc-900">{entityId}</p></div>
        <div className="sm:col-span-2"><span className="text-xs text-zinc-500">Remarks</span><p className="mt-0.5 text-zinc-800">{log.remarks || '—'}</p></div>
      </div>
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-bold text-zinc-900">Changed fields</h3>
        {changes.length ? (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600"><tr><th className="px-3 py-2.5">Field</th><th className="px-3 py-2.5">Previous value</th><th className="px-3 py-2.5">New value</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {changes.map((change) => (
                  <tr key={change.field}>
                    <td className="px-3 py-3 font-medium text-zinc-800">{change.field}</td>
                    <td className="max-w-xs px-3 py-3 break-words text-zinc-600"><span className="rounded-lg bg-brand-50 px-2 py-1 text-brand-700">{change.from || '—'}</span></td>
                    <td className="max-w-xs px-3 py-3 break-words text-zinc-900"><span className="rounded-lg bg-mpesa-500/10 px-2 py-1 text-mpesa-700">{change.to || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rounded-xl border border-zinc-200 px-3 py-4 text-sm text-zinc-500">No changes detected for this audit entry.</p>}
      </div>
    </Modal>
  )
}

function timestampParts(value: string) {
  const date = new Date(value)
  return {
    date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  }
}

export function AdminAuditLogs() {
  const { data } = useAdmin()
  const [idQuery, setIdQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' })
  const [actions, setActions] = useState<Set<string>>(new Set())
  const [entityTypes, setEntityTypes] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ascending, setAscending] = useState(false)
  const [compact, setCompact] = useState(false)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({ user: true, action: true, entityType: true, remarks: true, changes: true })

  const auditRows = useMemo(() => data.auditLogs.map((log) => {
    const resolved = resolveAuditEntity(data, log.action, log.target)
    return { ...log, entityId: log.entityId ?? resolved.entityId, entityType: log.entityType ?? resolved.entityType }
  }), [data])

  const filteredRows = useMemo(() => auditRows
    .filter((log) => {
      const entityId = log.entityId ?? ''
      const matchesId = !idQuery.trim() || `${entityId} ${log.id} ${log.target} ${log.action}`.toLowerCase().includes(idQuery.trim().toLowerCase())
      const matchesDate = isInRange(log.at.slice(0, 10), dateRange)
      const matchesAction = !actions.size || actions.has(auditActionCategory(log.action))
      const matchesEntity = !entityTypes.size || entityTypes.has(auditEntityType(log))
      const matchesUser = !users.size || users.has(log.actor)
      return matchesId && matchesDate && matchesAction && matchesEntity && matchesUser
    })
    .sort((a, b) => ascending ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)), [auditRows, idQuery, dateRange, actions, entityTypes, users, ascending])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstItem = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0
  const lastItem = Math.min(currentPage * pageSize, filteredRows.length)
  const hasFilters = !!idQuery || !!dateRange.from || !!dateRange.to || actions.size > 0 || entityTypes.size > 0 || users.size > 0

  const resetPage = () => setPage(1)
  const clearFilters = () => {
    setIdQuery('')
    setDateRange({ from: '', to: '' })
    setActions(new Set())
    setEntityTypes(new Set())
    setUsers(new Set())
    setPage(1)
  }
  const toggleColumn = (key: ColumnKey, value: boolean) => setColumns((current) => ({ ...current, [key]: value }))
  const exportRows = () => downloadCsv(
    'audit-logs.csv',
    ['Entity ID', 'Timestamp', 'User', 'Action', 'Entity Type', 'Remarks', 'Target', 'Changes'],
    filteredRows.map((log) => [
      log.entityId ?? log.id,
      log.at,
      log.actor,
      log.action,
      auditEntityType(log),
      log.remarks ?? '',
      log.target,
      (log.changes ?? []).map((change) => `${change.field}: ${change.from || '—'} → ${change.to || '—'}`).join('; '),
    ]),
  )

  const header: ReactNode[] = [
    'Entity ID',
    <button key="timestamp" type="button" onClick={() => { setAscending((value) => !value); resetPage() }} className="inline-flex items-center gap-1.5 hover:text-brand-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20" aria-label={`Sort by timestamp ${ascending ? 'descending' : 'ascending'}`}>
      Timestamp {ascending ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
    </button>,
    ...(columns.user ? ['User'] : []),
    ...(columns.action ? ['Action'] : []),
    ...(columns.entityType ? ['Entity Type'] : []),
    ...(columns.remarks ? ['Remarks'] : []),
    ...(columns.changes ? ['Action'] : []),
  ]

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="View and filter system audit logs for record changes."
        actions={<Button onClick={exportRows}><Download className="size-4" /> Export</Button>}
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={idQuery} onChange={(value) => { setIdQuery(value); resetPage() }} placeholder="Search by ID" className="w-full sm:w-52" />
          <DateRangePicker value={dateRange} onChange={(value) => { setDateRange(value); resetPage() }} emptyLabel="Date Range" />
          <FilterMenu label="Action" options={AUDIT_ACTION_CATEGORIES} selected={actions} onChange={(value) => { setActions(value); resetPage() }} />
          <FilterMenu label="Entity Type" options={AUDIT_ENTITY_TYPES} selected={entityTypes} onChange={(value) => { setEntityTypes(value); resetPage() }} />
          <FilterMenu label="User" options={[...new Set(auditRows.map((log) => log.actor))].sort()} selected={users} onChange={(value) => { setUsers(value); resetPage() }} />
          <ViewMenu visible={columns} onChange={toggleColumn} compact={compact} onCompactChange={setCompact} />
        </div>
      </Card>

      {filteredRows.length ? (
        <>
          <Table head={header} minWidth={1120}>
            {pageRows.map((log) => {
              const id = log.entityId ?? log.id
              const entityType = auditEntityType(log)
              const action = auditActionCategory(log.action)
              const timestamp = timestampParts(log.at)
              const actor = data.people.find((person) => person.name === log.actor)
              return (
                <tr key={log.id} className="transition hover:bg-zinc-50/80">
                  <td className={cn('whitespace-nowrap px-3 text-xs text-zinc-700', compact ? 'py-2' : 'py-3')}>
                    <span title={log.entityId ? 'Affected record ID' : 'Audit entry ID'} className="inline-block max-w-28 truncate font-mono tabular-nums">{id}</span>
                  </td>
                  <td className={cn('whitespace-nowrap px-3 text-xs', compact ? 'py-2' : 'py-3')}>
                    <p className="font-medium text-zinc-700">{timestamp.date}</p>
                    <p className="mt-0.5 text-zinc-500">{timestamp.time}</p>
                  </td>
                  {columns.user && (
                    <td className={cn('px-3', compact ? 'py-2' : 'py-3')}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={actor?.name ?? log.actor} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-zinc-800">{log.actor}</span>
                          <span className="block truncate text-[11px] text-zinc-500">{actor?.email ?? '—'}</span>
                        </span>
                      </div>
                    </td>
                  )}
                  {columns.action && <td className={cn('px-3', compact ? 'py-2' : 'py-3')}><Badge tone={ACTION_TONES[action]}>{action}</Badge></td>}
                  {columns.entityType && <td className={cn('whitespace-nowrap px-3 text-xs text-zinc-800', compact ? 'py-2' : 'py-3')}>{entityType}</td>}
                  {columns.remarks && <td className={cn('max-w-56 px-3 text-xs text-zinc-500', compact ? 'py-2' : 'py-3')}><span className="line-clamp-2">{log.remarks || '—'}</span></td>}
                  {columns.changes && (
                    <td className={cn('whitespace-nowrap px-3', compact ? 'py-2' : 'py-3')}>
                      {log.changes?.length ? (
                        <button type="button" onClick={() => setSelectedLog(log)} className="rounded-lg border border-brand-200 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 shadow-xs hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20">View Changes ({log.changes.length})</button>
                      ) : <span className="text-xs text-zinc-500">No changes detected</span>}
                    </td>
                  )}
                </tr>
              )
            })}
          </Table>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
            <p>{firstItem}–{lastItem} of {filteredRows.length} items</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 whitespace-nowrap">
                Rows per page
                <Select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="w-20">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </Select>
              </label>
              <span className="whitespace-nowrap">Page {currentPage} of {pageCount}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage(1)} aria-label="First page" className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronsLeft className="size-3.5" /></button>
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, Math.min(value, pageCount) - 1))} aria-label="Previous page" className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
                <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))} aria-label="Next page" className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
                <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(pageCount)} aria-label="Last page" className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"><ChevronsRight className="size-3.5" /></button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <Card>
          <Empty icon={FileClock} title="No audit logs match" text="Try changing or clearing the filters." action={hasFilters && <Button size="sm" onClick={clearFilters}><X className="size-3.5" /> Clear filters</Button>} />
        </Card>
      )}
      {selectedLog && <ChangeDetails log={selectedLog} entityId={selectedLog.entityId ?? selectedLog.id} onClose={() => setSelectedLog(null)} />}
    </>
  )
}
