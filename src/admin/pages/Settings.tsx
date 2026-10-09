import { Award, Check, Download, FileClock, Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { dateTime } from '../helpers'
import { uid, useAdmin } from '../store'
import type { CertificateTemplate, TrainingType } from '../types'
import { Badge, Button, Card, downloadCsv, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, Textarea } from '../ui'

/* ---------------------------- Certificate templates --------------------------- */

const accents = {
  green: { border: 'border-mpesa-600', text: 'text-mpesa-700', seal: 'bg-mpesa-600', bg: 'bg-white' },
  red: { border: 'border-brand-600', text: 'text-brand-700', seal: 'bg-brand-600', bg: 'bg-white' },
  dark: { border: 'border-amber-400', text: 'text-amber-300', seal: 'bg-amber-500', bg: 'bg-zinc-900' },
}

export function CertificatePreview({ template, name = 'Participant Name', course = 'M-PESA Call Center Training' }: { template: CertificateTemplate; name?: string; course?: string }) {
  const a = accents[template.accent]
  const dark = template.accent === 'dark'
  // Fixed light/dark palette: certificates print the same regardless of app theme.
  return (
    <div className={cn('relative aspect-[1.414] w-full overflow-hidden text-[clamp(0.35rem,1vw,0.6rem)]', a.bg)}>
      <div className={cn('absolute inset-[4%] border-[0.35em]', a.border)} />
      <div className="relative flex h-full flex-col items-center justify-center px-[12%] text-center">
        <p className={cn('text-[2em] font-extrabold', dark ? 'text-white' : 'text-[#e60a2a]')}>
          m<span className="text-[#39b54a]">-</span>pesa
        </p>
        <p className={cn('mt-[0.8em] text-[1em] font-semibold tracking-[0.3em] uppercase', dark ? 'text-[#d4d4d8]' : 'text-[#71717a]')}>{template.title}</p>
        <p className={cn('mt-[1.4em] text-[2.2em] font-semibold', dark ? 'text-white' : 'text-[#18181b]')}>{name}</p>
        <p className={cn('mt-[0.6em] text-[1.2em] font-semibold', a.text)}>{course}</p>
        <span className={cn('mt-[1.6em] grid size-[4em] place-items-center rounded-full text-white', a.seal)}>
          <Award className="size-[2em]" />
        </span>
      </div>
    </div>
  )
}

function TemplateModal({ template, onClose }: { template?: CertificateTemplate; onClose: () => void }) {
  const { update } = useAdmin()
  const [form, setForm] = useState({ name: template?.name ?? '', title: template?.title ?? 'Certificate of Completion', accent: template?.accent ?? ('green' as CertificateTemplate['accent']) })
  const draft: CertificateTemplate = { id: template?.id ?? uid('ct'), isDefault: template?.isDefault ?? false, ...form }

  const save = () => {
    update((d) => ({ ...d, templates: template ? d.templates.map((t) => (t.id === template.id ? draft : t)) : [...d.templates, draft] }), {
      action: template ? 'Updated certificate template' : 'Created certificate template',
      target: draft.name,
    })
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={template ? 'Edit template' : 'New template'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!form.name.trim() || !form.title.trim()} onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Field label="Template name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Certificate title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-700">Style</p>
            <div className="flex gap-2">
              {(['green', 'red', 'dark'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setForm({ ...form, accent: k })}
                  className={cn('grid size-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface', accents[k].seal, form.accent === k ? 'ring-zinc-900' : 'ring-transparent')}
                  aria-label={k}
                  aria-pressed={form.accent === k}
                >
                  {form.accent === k && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
          <CertificatePreview template={draft} />
        </div>
      </div>
    </Modal>
  )
}

export function AdminCertificateTemplates() {
  const { data, update } = useAdmin()
  const [editing, setEditing] = useState<CertificateTemplate | 'new' | null>(null)

  const makeDefault = (t: CertificateTemplate) =>
    update((d) => ({ ...d, templates: d.templates.map((x) => ({ ...x, isDefault: x.id === t.id })) }), { action: 'Set default certificate template', target: t.name })

  return (
    <>
      <PageHeader
        title="Certificate Templates"
        description="The default template is issued when a participant completes a training."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New template
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.templates.map((t) => (
          <Card key={t.id} className="p-0">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4">
              <div className="overflow-hidden rounded shadow-sm">
                <CertificatePreview template={t} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-zinc-900">
                  {t.name} {t.isDefault && <Badge tone="green">DEFAULT</Badge>}
                </p>
                <p className="truncate text-xs text-zinc-500">{t.title}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!t.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault(t)}>
                    Set default
                  </Button>
                )}
                <Button size="sm" onClick={() => setEditing(t)}>
                  Edit
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && <TemplateModal template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* -------------------------------- Training types ------------------------------ */

function TypeModal({ type, onClose }: { type?: TrainingType; onClose: () => void }) {
  const { update } = useAdmin()
  const [form, setForm] = useState({
    name: type?.name ?? '',
    category: type?.category ?? ('Internal' as TrainingType['category']),
    level: type?.level ?? ('Beginner' as TrainingType['level']),
    description: type?.description ?? '',
  })
  const save = () => {
    const next: TrainingType = { id: type?.id ?? uid('tt'), ...form, name: form.name.trim(), description: form.description.trim() }
    update((d) => ({ ...d, trainingTypes: type ? d.trainingTypes.map((t) => (t.id === type.id ? next : t)) : [...d.trainingTypes, next] }), {
      action: type ? 'Updated training type' : 'Created training type',
      target: next.name,
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={type ? 'Edit training type' : 'New training type'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!form.name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
        </div>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TrainingType['category'] })}>
            <option>Internal</option>
            <option>Partner</option>
            <option>Customer</option>
          </Select>
        </Field>
        <Field label="Level">
          <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as TrainingType['level'] })}>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

const levelTone = { Beginner: 'green', Intermediate: 'amber', Advanced: 'red' } as const

export function AdminTrainingTypes({ byCategory = false }: { byCategory?: boolean }) {
  const { data } = useAdmin()
  const [editing, setEditing] = useState<TrainingType | 'new' | null>(null)
  const usage = (id: string) => data.trainings.filter((t) => t.typeId === id).length

  const card = (t: TrainingType) => (
    <Card key={t.id} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-zinc-900">{t.name}</h3>
        <Badge tone={levelTone[t.level]}>{t.level.toUpperCase()}</Badge>
      </div>
      <p className="mt-1 flex-1 text-sm text-zinc-500">{t.description || 'No description.'}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {t.category} · {usage(t.id)} trainings
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
          Edit
        </Button>
      </div>
    </Card>
  )

  return (
    <>
      <PageHeader
        title={byCategory ? 'Training Types by Category' : 'Training Types'}
        description="Classify trainings by audience and difficulty."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New type
          </Button>
        }
      />
      {byCategory ? (
        <div className="space-y-8">
          {(['Internal', 'Partner', 'Customer'] as const).map((c) => {
            const items = data.trainingTypes.filter((t) => t.category === c)
            return (
              <section key={c}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  {c} <span className="font-normal text-zinc-500">{items.length}</span>
                </h2>
                {items.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div> : <p className="text-sm text-zinc-500">No types in this category.</p>}
              </section>
            )
          })}
        </div>
      ) : data.trainingTypes.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{data.trainingTypes.map(card)}</div>
      ) : (
        <Card>
          <Empty icon={Settings2} title="No training types" />
        </Card>
      )}
      {editing && <TypeModal type={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ---------------------------------- Audit logs -------------------------------- */

export function AdminAuditLogs() {
  const { data } = useAdmin()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('')
  const actors = [...new Set(data.auditLogs.map((l) => l.actor))]
  const rows = data.auditLogs
    .filter((l) => (!actor || l.actor === actor) && (!q || `${l.action} ${l.target}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="A record of every change made in the admin dashboard."
        actions={
          <Button onClick={() => downloadCsv('audit-logs.csv', ['When', 'Actor', 'Action', 'Target'], rows.map((l) => [l.at, l.actor, l.action, l.target]))}>
            <Download className="size-4" /> Export
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search actions or targets…" className="w-full sm:w-72" />
        <Select value={actor} onChange={(e) => setActor(e.target.value)} className="w-full sm:w-56">
          <option value="">All people</option>
          {actors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
      </div>
      {rows.length ? (
        <Table head={['When', 'Who', 'Action', 'Target']}>
          {rows.map((l) => (
            <tr key={l.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{dateTime(l.at)}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{l.actor}</td>
              <td className="px-4 py-3 text-zinc-700">{l.action}</td>
              <td className="px-4 py-3 text-zinc-600">{l.target}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Card>
          <Empty icon={FileClock} title="No log entries match" />
        </Card>
      )}
    </>
  )
}
