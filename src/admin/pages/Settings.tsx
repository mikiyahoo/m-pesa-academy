import { Check, FileText, Plus, Settings2, Upload, X } from 'lucide-react'
import { CERTIFICATE_LAYOUTS, CertificateDesign } from '../../components/CertificateDesign'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { CERTIFICATE_PDF_FIELDS, inspectCertificatePdf } from '../../lib/fillableCertificate'
import { uid, useAdmin } from '../store'
import type { CertificateTemplate, TrainingType } from '../types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea } from '../ui'

/* ---------------------------- Certificate templates --------------------------- */

/** Admin preview of a template, rendered with the same layout learners receive. */
export function CertificatePreview({
  template,
  name = 'Participant Name',
  course = 'M-PESA Call Center Training',
  trainer = 'Trainer Name',
  email = 'participant@example.com',
  certificateId = 'MPL-SAMPLE-0001',
  issued,
  score,
}: {
  template: CertificateTemplate
  name?: string
  course?: string
  trainer?: string
  email?: string
  certificateId?: string
  issued?: string
  score?: number
}) {
  return (
    <CertificateDesign
      layout={template.layout ?? 'border'}
      pdfTemplate={template.pdfTemplateData}
      fields={{ name, email, course, trainer, certificateId, score, issued: issued ?? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }}
    />
  )
}

function TemplateModal({ template, onClose }: { template?: CertificateTemplate; onClose: () => void }) {
  const { update } = useAdmin()
  const { data } = useAdmin()
  const [form, setForm] = useState({
    name: template?.name ?? '',
    title: template?.title ?? 'Certificate of Completion',
    accent: template?.accent ?? ('red' as CertificateTemplate['accent']),
    layout: template?.layout ?? ('border' as NonNullable<CertificateTemplate['layout']>),
    assignedTypeIds: template?.assignedTypeIds ?? [],
  })
  const draft: CertificateTemplate = {
    id: template?.id ?? uid('ct'),
    isDefault: template?.isDefault ?? false,
    pdfTemplateData: template?.pdfTemplateData,
    pdfFileName: template?.pdfFileName,
    pdfFileSize: template?.pdfFileSize,
    ...form,
  }
  const typeNames = (ids: string[]) => ids.map((id) => data.trainingTypes.find((t) => t.id === id)?.name ?? id).join(', ') || '—'

  const save = () => {
    // A training type uses one template: assigning it here removes it from the others (X03).
    update(
      (d) => ({
        ...d,
        templates: (template ? d.templates.map((t) => (t.id === template.id ? draft : t)) : [...d.templates, draft]).map((t) =>
          t.id === draft.id ? t : { ...t, assignedTypeIds: t.assignedTypeIds?.filter((id) => !draft.assignedTypeIds?.includes(id)) },
        ),
      }),
      {
        action: template ? 'Updated certificate template' : 'Created certificate template',
        target: draft.name,
        changes: template
          ? [
              { field: 'Name', from: template.name, to: draft.name },
              { field: 'Title', from: template.title, to: draft.title },
              { field: 'Layout', from: template.layout ?? 'border', to: draft.layout ?? 'border' },
              { field: 'Training types', from: typeNames(template.assignedTypeIds ?? []), to: typeNames(draft.assignedTypeIds ?? []) },
            ]
          : undefined,
      },
    )
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
          {template?.pdfTemplateData ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
              <p className="text-sm font-semibold text-blue-900">Imported fillable PDF</p>
              <p className="mt-1 break-all text-xs text-blue-800">{template.pdfFileName}</p>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-sm font-medium text-zinc-700">Layout</p>
              <div className="space-y-2">
                {CERTIFICATE_LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setForm({ ...form, layout: l.value })}
                    aria-pressed={form.layout === l.value}
                    className={cn('flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition', form.layout === l.value ? 'border-brand-500 bg-brand-50/60' : 'border-zinc-200 hover:bg-zinc-50')}
                  >
                    <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', form.layout === l.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300')}>
                      {form.layout === l.value && <Check className="size-3" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-zinc-900">{l.label}</span>
                      <span className="block text-xs text-zinc-500">{l.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
          <CertificatePreview template={draft} />
        </div>
        <div className="md:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Use for training types</p>
          <p className="mb-2 text-xs text-zinc-500">Other types get the default template. Each type can use only one template.</p>
          <div className="flex flex-wrap gap-2">
            {data.trainingTypes.map((tt) => {
              const on = form.assignedTypeIds.includes(tt.id)
              const elsewhere = data.templates.find((t) => t.id !== draft.id && t.assignedTypeIds?.includes(tt.id))
              return (
                <button
                  key={tt.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setForm({ ...form, assignedTypeIds: on ? form.assignedTypeIds.filter((x) => x !== tt.id) : [...form.assignedTypeIds, tt.id] })}
                  className={cn('rounded-xl border px-3 py-1.5 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50')}
                  title={elsewhere && !on ? 'Currently uses ' + elsewhere.name : undefined}
                >
                  {tt.name}
                  {elsewhere && !on && <span className="ml-1 text-zinc-400">({elsewhere.name})</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ImportTemplateModal({ onClose }: { onClose: () => void }) {
  const { update } = useAdmin()
  const [name, setName] = useState('')
  const [file, setFile] = useState<{ data: string; fileName: string; size: number } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  const readFile = async (candidate?: File) => {
    if (!candidate) return
    setError('')
    setBusy(true)
    try {
      setFile(await inspectCertificatePdf(candidate))
    } catch (reason) {
      setFile(null)
      setError(reason instanceof Error ? reason.message : 'Could not read this PDF template.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!file || !name.trim()) return
    const template: CertificateTemplate = {
      id: uid('ct'),
      name: name.trim(),
      title: 'Certificate of Completion',
      accent: 'red',
      layout: 'border',
      isDefault: false,
      pdfTemplateData: file.data,
      pdfFileName: file.fileName,
      pdfFileSize: file.size,
      assignedTypeIds: [],
    }
    update((data) => ({ ...data, templates: [...data.templates, template] }), {
      action: 'Imported certificate template',
      target: template.name,
      changes: [{ field: 'PDF file', from: '', to: file.fileName }],
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import certificate template"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || !file || busy} onClick={save}>Import template</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Template name">
          <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="e.g. All training feedback" />
        </Field>
        <Field label="Fillable PDF template">
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]) }}
            className={cn('rounded-xl border border-dashed p-5 transition', dragging ? 'border-brand-500 bg-brand-50/60' : 'border-zinc-300 bg-zinc-50/60 hover:border-brand-300 hover:bg-brand-50/30')}
          >
            <input
              id="certificate-template-pdf"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => { void readFile(event.target.files?.[0]); event.currentTarget.value = '' }}
            />
            {file ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><FileText className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{file.fileName}</span>
                    <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(0)} KB · Fillable PDF</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="certificate-template-pdf" className="cursor-pointer text-xs font-semibold text-brand-700 hover:underline">Replace file</label>
                  <button type="button" onClick={() => setFile(null)} aria-label="Remove selected PDF" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200"><X className="size-4" /></button>
                </div>
              </div>
            ) : (
              <label htmlFor="certificate-template-pdf" className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 text-center">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Upload className="size-5" /></span>
                <span className="text-sm font-semibold text-zinc-800">{busy ? 'Checking PDF fields…' : 'Drag and drop or click to upload'}</span>
                <span className="text-xs text-zinc-500">PDF up to 2 MB</span>
              </label>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-medium text-brand-600">{error}</p>}
        </Field>
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-2.5 text-brand-700">
          <p className="text-xs font-semibold">Supported PDF placeholders</p>
          <div className="scrollbar-none mt-1.5 flex flex-nowrap gap-1 overflow-x-auto">
            {CERTIFICATE_PDF_FIELDS.map((fieldName) => <code key={fieldName} className="shrink-0 whitespace-nowrap rounded-md border border-brand-200 bg-white/80 px-1 py-0.5 font-mono text-[10px] text-brand-700">{fieldName}</code>)}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function AdminCertificateTemplates() {
  const { data, update } = useAdmin()
  const [editing, setEditing] = useState<CertificateTemplate | 'new' | null>(null)
  const [importing, setImporting] = useState(false)

  const makeDefault = (t: CertificateTemplate) =>
    update((d) => ({ ...d, templates: d.templates.map((x) => ({ ...x, isDefault: x.id === t.id })) }), { action: 'Set default certificate template', target: t.name })

  return (
    <>
      <PageHeader
        title="Certificate Templates"
        description="Assign templates to training types; every other type gets the default."
        actions={
          <>
            <Button onClick={() => setImporting(true)}><Upload className="size-4" /> Import template</Button>
            <Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" /> New template</Button>
          </>
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
                  {t.name} {t.pdfTemplateData && <Badge tone="blue">PDF</Badge>} {t.isDefault && <Badge tone="green">DEFAULT</Badge>}
                </p>
                <p className="truncate text-xs text-zinc-500">{t.title}</p>
                {t.pdfFileName && <p className="truncate text-xs text-zinc-500">{t.pdfFileName}</p>}
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {t.assignedTypeIds?.length ? 'Used for ' + t.assignedTypeIds.map((id) => data.trainingTypes.find((x) => x.id === id)?.name ?? id).join(', ') : t.isDefault ? 'Used for all other types' : 'Not assigned'}
                </p>
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
      {importing && <ImportTemplateModal onClose={() => setImporting(false)} />}
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
        <h3 className="font-bold text-zinc-900">{t.name}</h3>
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
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900">
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

