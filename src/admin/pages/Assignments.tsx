import { AlarmClock, BellRing, BookOpenCheck, CheckCircle2, ClipboardList, Download, Eye, FileText, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RowMenu } from '../../components/RowMenu'
import { useFeedback } from '../../components/Feedback'
import { assignedPeople, assignmentDone, assignmentState, isAssigned, type AssignmentState } from '../../lib/assignments'
import { cn, localISO, todayISO } from '../../lib/utils'
import { shortDate } from '../helpers'
import { useAdmin } from '../store'
import type { Material } from '../types'
import { Badge, Button, Card, downloadCsv, Empty, Modal, PageHeader, ProgressBar, SearchInput, StatCard, Table, Tabs } from '../ui'

const stateTone: Record<AssignmentState, 'green' | 'zinc' | 'amber' | 'red'> = { Acknowledged: 'green', Read: 'green', 'Not opened': 'zinc', Overdue: 'red' }

type Filter = 'all' | 'open' | 'overdue' | 'done'

/** Reading assignments (no session): who has opened and acknowledged each assigned material. */
export function AdminAssignments() {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [viewing, setViewing] = useState<Material | null>(null)
  const today = todayISO()

  const rows = useMemo(
    () =>
      data.materials.filter(isAssigned).map((m) => {
        const people = assignedPeople(data, m)
        const done = people.filter((p) => assignmentDone(m, p.id)).length
        const opened = people.filter((p) => m.assignmentProgress?.[p.id]?.openedAt).length
        const overdue = m.dueDate && m.dueDate < today ? people.length - done : 0
        return { m, people, done, opened, overdue, pct: people.length ? Math.round((done / people.length) * 100) : 0 }
      }),
    [data, today],
  )
  const groupName = (id: string) => data.groups.find((g) => g.id === id)?.name ?? id
  const match = (r: (typeof rows)[number], f: Filter) => f === 'all' || (f === 'overdue' ? r.overdue > 0 : f === 'done' ? r.pct === 100 : r.pct < 100)
  const visible = rows.filter((r) => match(r, filter) && (!q || r.m.title.toLowerCase().includes(q.toLowerCase())))

  const people = rows.reduce((n, r) => n + r.people.length, 0)
  const done = rows.reduce((n, r) => n + r.done, 0)
  const overdue = rows.reduce((n, r) => n + r.overdue, 0)

  const remind = (m: Material, ids: string[]) => {
    if (!ids.length) return toast('Everyone has finished this one')
    const at = localISO()
    update(
      (d) => ({
        ...d,
        materials: d.materials.map((x) =>
          x.id === m.id ? { ...x, assignmentProgress: { ...x.assignmentProgress, ...Object.fromEntries(ids.map((id) => [id, { ...x.assignmentProgress?.[id], remindedAt: at }])) } } : x,
        ),
      }),
      { action: 'Sent reading reminders', target: `${m.title} · ${ids.length}` },
    )
    toast(`Reminder queued for ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`)
  }

  const exportAll = () =>
    downloadCsv(
      'reading-assignments.csv',
      ['Material', 'Person', 'Email', 'Status', 'Opened', 'Acknowledged', 'Due'],
      rows.flatMap((r) =>
        r.people.map((p) => [r.m.title, p.name, p.email, assignmentState(r.m, p.id, today), r.m.assignmentProgress?.[p.id]?.openedAt ?? '', r.m.assignmentProgress?.[p.id]?.acknowledgedAt ?? '', r.m.dueDate ?? '']),
      ),
    )

  return (
    <>
      <PageHeader
        title="Assignments"
        actions={
          <>
            <Button onClick={exportAll} disabled={!rows.length}>
              <Download className="size-4" /> Export
            </Button>
            <Link to="/admin/materials" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700">
              <ClipboardList className="size-4" /> Assign from materials
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={FileText} tone="red" label="Assigned materials" value={rows.length} />
        <StatCard icon={Users} tone="zinc" label="People reached" value={people} />
        <StatCard icon={CheckCircle2} tone="green" label="Completed" value={`${people ? Math.round((done / people) * 100) : 0}%`} hint={`${done} of ${people}`} />
        <StatCard icon={AlarmClock} tone="amber" label="Overdue" value={overdue} />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          label="Filter assignments"
          items={[
            { value: 'all', label: 'All', count: rows.length },
            { value: 'open', label: 'In progress', count: rows.filter((r) => match(r, 'open')).length },
            { value: 'overdue', label: 'Overdue', count: rows.filter((r) => match(r, 'overdue')).length },
            { value: 'done', label: 'Completed', count: rows.filter((r) => match(r, 'done')).length },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search assignments…" className="w-full sm:w-64" />
      </div>

      {visible.length ? (
        <Table head={['Material', 'Groups', 'Due', 'Opened', 'Progress', '']} minWidth={820}>
          {visible.map((r) => (
            <tr key={r.m.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <button onClick={() => setViewing(r.m)} className="flex items-center gap-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <BookOpenCheck className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900 hover:text-brand-600">{r.m.title}</span>
                    <span className="block text-xs text-zinc-500">{r.m.requiresAck ? 'Acknowledgement required' : 'Opening counts as done'}</span>
                  </span>
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-56 flex-wrap gap-1">
                  {(r.m.assignedGroupIds ?? []).map((g) => (
                    <Badge key={g}>{groupName(g)}</Badge>
                  ))}
                </div>
              </td>
              <td className={cn('px-4 py-3 whitespace-nowrap', r.overdue ? 'font-medium text-brand-700' : 'text-zinc-600')}>{r.m.dueDate ? shortDate(r.m.dueDate) : '—'}</td>
              <td className="px-4 py-3 text-zinc-600 tabular-nums">
                {r.opened}/{r.people.length}
              </td>
              <td className="px-4 py-3">
                <div className="flex min-w-36 items-center gap-2.5">
                  <ProgressBar value={r.pct} tone={r.pct === 100 ? 'green' : 'red'} className="flex-1" />
                  <span className="w-10 text-right text-xs font-semibold text-zinc-700 tabular-nums">{r.pct}%</span>
                </div>
                {r.overdue > 0 && <span className="mt-1 block text-xs text-brand-700">{r.overdue} overdue</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <RowMenu
                  label={`Actions for ${r.m.title}`}
                  items={[
                    { label: 'View people', icon: Eye, onClick: () => setViewing(r.m) },
                    { label: 'Send reminder', icon: BellRing, onClick: () => remind(r.m, r.people.filter((p) => !assignmentDone(r.m, p.id)).map((p) => p.id)) },
                    { label: 'Edit assignment', icon: ClipboardList, to: '/admin/materials' },
                  ]}
                />
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Card>
          <Empty
            icon={BookOpenCheck}
            title={rows.length ? 'No assignments match' : 'No reading assigned yet'}
            text={rows.length ? 'Try another filter or search.' : 'Open Materials and choose “Assign to groups” on a document to send it without a training.'}
          />
        </Card>
      )}

      {viewing && <PeopleModal material={data.materials.find((m) => m.id === viewing.id) ?? viewing} onClose={() => setViewing(null)} onRemind={remind} />}
    </>
  )
}

function PeopleModal({ material: m, onClose, onRemind }: { material: Material; onClose: () => void; onRemind: (m: Material, ids: string[]) => void }) {
  const { data } = useAdmin()
  const today = todayISO()
  const people = assignedPeople(data, m)
  const pending = people.filter((p) => !assignmentDone(m, p.id)).map((p) => p.id)
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={m.title}
      description={`${people.length} people · ${m.dueDate ? `due ${shortDate(m.dueDate)}` : 'no due date'} · ${m.requiresAck ? 'acknowledgement required' : 'opening counts as done'}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!pending.length} onClick={() => onRemind(m, pending)}>
            <BellRing className="size-4" /> Remind {pending.length || ''} not finished
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-zinc-100">
        {people.map((p) => {
          const st = assignmentState(m, p.id, today)
          const prog = m.assignmentProgress?.[p.id]
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{p.name}</span>
                <span className="block truncate text-xs text-zinc-500">{p.email}</span>
              </span>
              <span className="text-xs text-zinc-500">
                {prog?.acknowledgedAt ? `Acknowledged ${shortDate(prog.acknowledgedAt.slice(0, 10))}` : prog?.openedAt ? `Opened ${shortDate(prog.openedAt.slice(0, 10))}` : prog?.remindedAt ? `Reminded ${shortDate(prog.remindedAt.slice(0, 10))}` : ''}
              </span>
              <Badge tone={stateTone[st]}>{st}</Badge>
            </li>
          )
        })}
        {!people.length && (
          <li>
            <Empty compact icon={Users} title="No one to show" text="There are no active people in the assigned groups." />
          </li>
        )}
      </ul>
    </Modal>
  )
}
