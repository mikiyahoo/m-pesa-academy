import { ArrowDown, ArrowUp, BookOpen, Calendar, Check, Download, ExternalLink, Eye, FileText, Layers, Pencil, PlayCircle, Plus, RefreshCw, Trash2, Upload, UserPlus, Users, X } from 'lucide-react'
import { RowMenu } from '../../components/RowMenu'
import { canDownloadFile, countDownload, deleteMaterialFile, downloadMaterial, formatBytes, materialFileName, saveMaterialFile } from '../materialFiles'
import { assignedPeople } from '../../lib/assignments'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { localISO } from '../../lib/utils'
import { MaterialPreview, materialIcon } from '../MaterialPreview'
import { MaterialAttachmentPreview } from '../MaterialAttachmentPreview'
import { useScope } from '../scope'
import { videoSource } from '../embeds'
import { uid, useAdmin } from '../store'
import type { Journey, Material, MaterialType, TrainingLevel } from '../types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, TabBar, Tabs, Textarea } from '../ui'
import { Wizard, WizardCard, type WizardStep } from '../Wizard'
import { journeyIdsOf } from '../journeys'

const LEVELS: TrainingLevel[] = ['Novice', 'Beginner', 'Intermediate', 'Advanced']
const THUMBNAILS = ['red', 'fayda', 'green', 'blue', 'amber', 'zinc'] as const
const CURRENT_ADMIN = 'Fasil Wolde'

/* ---------------------------------- Journeys --------------------------------- */

function NewJourneyModal({ onClose }: { onClose: () => void }) {
  const { update } = useAdmin()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const save = () => {
    const j: Journey = { id: uid('j'), name: name.trim(), description: description.trim(), startDate: startDate || undefined, endDate: endDate || undefined, modules: [] }
    update((d) => ({ ...d, journeys: [...d.journeys, j] }), { action: 'Created journey', target: j.name })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="New journey"
      description="A journey is an ordered set of modules that trainings follow."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Create journey
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function AdminJourneys() {
  const { data } = useAdmin()
  const [creating, setCreating] = useState(false)
  return (
    <>
      <PageHeader
        title="Journeys"
        description="Learning paths made of modules and materials."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New journey
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.journeys.map((j) => {
          const materials = new Set(j.modules.flatMap((m) => m.materialIds))
          const minutes = [...materials].reduce((s, id) => s + (data.materials.find((m) => m.id === id)?.minutes ?? 0), 0)
          const used = data.trainings.filter((t) => journeyIdsOf(t).includes(j.id)).length
          return (
            <Link key={j.id} to={`/admin/journeys/${j.id}`} className="group rounded-2xl border border-zinc-200/80 bg-surface p-5 transition hover:border-zinc-300 hover:shadow-md">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <BookOpen className="size-5" />
              </span>
              <h3 className="mt-4 font-bold text-zinc-900 group-hover:text-brand-600">{j.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{j.description || 'No description.'}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Layers className="size-3.5" /> {j.modules.length} modules
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="size-3.5" /> {materials.size} materials · {minutes} mins
                </span>
                <span>Used by {used} training{used === 1 ? '' : 's'}</span>
              </div>
              {(j.startDate || j.endDate) && (
                <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                  <Calendar className="size-3.5" />
                  {j.startDate ?? '…'} → {j.endDate ?? 'open'}
                </div>
              )}
            </Link>
          )
        })}
      </div>
      {creating && <NewJourneyModal onClose={() => setCreating(false)} />}
    </>
  )
}

export function AdminJourneyDetail() {
  const { id = '' } = useParams()
  const { data, update } = useAdmin()
  const journey = data.journeys.find((j) => j.id === id)
  const [newModule, setNewModule] = useState('')
  const [preview, setPreview] = useState<Material | null>(null)

  if (!journey) return <Empty icon={BookOpen} title="Journey not found" />

  const save = (modules: Journey['modules'], action: string) =>
    update((d) => ({ ...d, journeys: d.journeys.map((j) => (j.id === journey.id ? { ...j, modules } : j)) }), { action, target: journey.name })

  const patch = (changes: Partial<Journey>, action: string) =>
    update((d) => ({ ...d, journeys: d.journeys.map((j) => (j.id === journey.id ? { ...j, ...changes } : j)) }), { action, target: journey.name })

  const move = (i: number, dir: -1 | 1) => {
    const next = [...journey.modules]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    save(next, 'Reordered modules')
  }

  return (
    <>
      <PageHeader title={<>{journey.name} <Badge>JOURNEY</Badge></>} description={journey.description} />
      <Card className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
        <Field label="Start date">
          <Input type="date" value={journey.startDate ?? ''} onChange={(e) => patch({ startDate: e.target.value || undefined }, 'Set journey start date')} />
        </Field>
        <Field label="End date">
          <Input type="date" value={journey.endDate ?? ''} onChange={(e) => patch({ endDate: e.target.value || undefined }, 'Set journey end date')} />
        </Field>
        <p className="max-w-md text-xs leading-relaxed text-zinc-500">
          Modules unlock in order — each module's materials and assessment become available only after the previous module is completed.
        </p>
      </Card>
      <div className="space-y-3">
        {journey.modules.map((m, i) => {
          const available = data.materials.filter((x) => !m.materialIds.includes(x.id))
          return (
            <Card key={m.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">{i + 1}</span>
                <h3 className="min-w-40 flex-1 font-medium text-zinc-900">{m.title}</h3>
                <Field label="Assessment">
                  <Select
                    value={m.assessmentId ?? ''}
                    onChange={(e) =>
                      save(journey.modules.map((x) => (x.id === m.id ? { ...x, assessmentId: e.target.value || undefined } : x)), `Set assessment for ${m.title}`)
                    }
                    className="max-w-xs py-1.5 text-xs"
                  >
                    <option value="">None</option>
                    {data.assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" disabled={i === journey.modules.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => save(journey.modules.filter((x) => x.id !== m.id), `Deleted module ${m.title}`)}
                  aria-label="Delete module"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-2 pl-10">
                {m.materialIds.map((mid) => {
                  const mat = data.materials.find((x) => x.id === mid)
                  if (!mat) return null
                  const Icon = materialIcon[mat.type]
                  return (
                    <div key={mid} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2">
                      <Icon className="size-4 text-zinc-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-900">{mat.title}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">
                          {mat.type} · {mat.minutes} mins{mat.level ? ` · ${mat.level}` : ''}
                        </span>
                      </span>
                      <button onClick={() => setPreview(mat)} className="flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900">
                        <PlayCircle className="size-3.5" /> Preview
                      </button>
                      <button
                        onClick={() => save(journey.modules.map((x) => (x.id === m.id ? { ...x, materialIds: x.materialIds.filter((y) => y !== mid) } : x)), `Removed material from ${m.title}`)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                        aria-label="Remove material"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
                {available.length > 0 && (
                  <Select
                    value=""
                    onChange={(e) => save(journey.modules.map((x) => (x.id === m.id ? { ...x, materialIds: [...x.materialIds, e.target.value] } : x)), `Added material to ${m.title}`)}
                    className="max-w-xs py-1.5 text-xs"
                  >
                    <option value="">+ Add material…</option>
                    {available.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </Card>
          )
        })}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newModule.trim()) return
            save([...journey.modules, { id: uid('m'), title: newModule.trim(), materialIds: [] }], `Added module ${newModule.trim()}`)
            setNewModule('')
          }}
          className="flex gap-2 rounded-xl border border-dashed border-zinc-300 p-3"
        >
          <Input value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="New module title" />
          <Button type="submit" variant="primary" disabled={!newModule.trim()}>
            <Plus className="size-4" /> Add module
          </Button>
        </form>
      </div>
      <MaterialPreview material={preview} onClose={() => setPreview(null)} />
    </>
  )
}

/* --------------------------------- Materials --------------------------------- */

type TypeFilter = 'ALL' | MaterialType

function GroupPicker({ label, hint, selected, onChange }: { label: string; hint?: string; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const { data } = useAdmin()
  return (
    <div className="sm:col-span-2">
      <Field label={label} hint={hint}>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {data.groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="accent-mpesa-600"
                checked={selected.has(g.id)}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(g.id)
                  else next.delete(g.id)
                  onChange(next)
                }}
              />
              {g.name}
            </label>
          ))}
        </div>
      </Field>
    </div>
  )
}

type MaterialStep = 'details' | 'access' | 'review'

function MaterialModal({ material, onClose }: { material?: Material; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [form, setForm] = useState({
    title: material?.title ?? '',
    type: material?.type ?? ('DOCUMENT' as MaterialType),
    minutes: String(material?.minutes ?? 10),
    description: material?.description ?? '',
    level: material?.level ?? ('Beginner' as TrainingLevel),
    skills: (material?.skills ?? []).join(', '),
    thumbnail: material?.thumbnail ?? ('red' as (typeof THUMBNAILS)[number]),
    minViewSeconds: String(material?.minViewSeconds ?? 300),
    url: material?.url ?? '',
  })
  const [visible, setVisible] = useState<Set<string>>(new Set(material?.visibleGroupIds))
  const [downloadable, setDownloadable] = useState<Set<string>>(new Set(material?.downloadableGroupIds))
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const scope = useScope()
  // A trainer adding material is tagged on it automatically so they can keep editing it.
  const [trainers, setTrainers] = useState<Set<string>>(new Set(material?.taggedTrainerIds ?? (scope.trainerId ? [scope.trainerId] : [])))
  const acceptsFile = form.type === 'DOCUMENT' || form.type === 'PRESENTATION'
  const fileAccept = form.type === 'PRESENTATION' ? '.ppt,.pptx,.pdf' : '.pdf,.doc,.docx'
  const valid = !!form.title.trim() && Number(form.minutes) > 0 && (!!material || !acceptsFile || !!uploadedFile)
  const [step, setStep] = useState<MaterialStep>('details')

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const now = localISO()
      const fileId = uploadedFile ? await saveMaterialFile(uploadedFile) : material?.fileId
      const next: Material = {
        id: material?.id ?? uid('mat'),
        title: form.title.trim(),
        type: form.type,
        minutes: Number(form.minutes),
        description: form.description.trim(),
        updatedAt: now.slice(0, 10),
        level: form.level,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        thumbnail: form.thumbnail,
        minViewSeconds: form.type === 'DOCUMENT' ? Number(form.minViewSeconds) || 0 : undefined,
        url: form.url.trim() || undefined,
        downloadableGroupIds: form.type === 'VIDEO' ? [] : [...downloadable],
        visibleGroupIds: [...visible],
        taggedTrainerIds: [...trainers],
        version: material?.version ?? 1,
        fileId,
        fileName: uploadedFile?.name ?? material?.fileName,
        fileSize: uploadedFile?.size ?? material?.fileSize,
        history: material
          ? [...material.history, { at: now, by: CURRENT_ADMIN, change: 'Details updated' }]
          : [{ at: now, by: CURRENT_ADMIN, change: 'Created' }],
      }
      update(
        (d) => ({ ...d, materials: material ? d.materials.map((m) => (m.id === material.id ? next : m)) : [next, ...d.materials] }),
        {
          action: material ? 'Updated material' : 'Uploaded material',
          target: next.title,
          changes: material
            ? [
                { field: 'Title', from: material.title, to: next.title },
                { field: 'Type', from: material.type, to: next.type },
                { field: 'Level', from: material.level ?? '', to: next.level ?? '' },
                { field: 'Minutes', from: String(material.minutes), to: String(next.minutes) },
                { field: 'Visible to groups', from: String(material.visibleGroupIds.length || 'All'), to: String(next.visibleGroupIds.length || 'All') },
                { field: 'Downloadable groups', from: String(material.downloadableGroupIds.length), to: String(next.downloadableGroupIds.length) },
                { field: 'Tagged trainers', from: String(material.taggedTrainerIds.length), to: String(next.taggedTrainerIds.length) },
              ]
            : undefined,
        },
      )
      toast(material ? 'Material updated' : 'Material added')
      onClose()
    } catch {
      toast('The file could not be saved. Try again.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const groupNames = (ids: Set<string>, empty: string) => (ids.size ? data.groups.filter((g) => ids.has(g.id)).map((g) => g.name).join(', ') : empty)
  const steps: WizardStep<MaterialStep>[] = [
    { id: 'details', title: 'Details', problems: valid ? 0 : 1 },
    { id: 'access', title: 'Access & downloads' },
    { id: 'review', title: 'Review' },
  ]

  return (
    <Wizard title={material ? 'Edit material' : 'Add material'} steps={steps} step={step} onStep={setStep} onClose={onClose} onSave={save} canSave={!!valid && !saving} saveLabel={saving ? 'Saving file…' : material ? 'Save changes' : 'Add material'}>
      {step === 'details' && (
        <WizardCard icon={FileText} title="Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
              </Field>
            </div>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => { setUploadedFile(null); setForm({ ...form, type: e.target.value as MaterialType }) }}>
                {(['DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as MaterialType[]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Duration (minutes)">
              <Input type="number" min={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
            </Field>
            <Field label="Difficulty level">
              <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as TrainingLevel })}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Thumbnail">
              <Select value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value as (typeof THUMBNAILS)[number] })}>
                {THUMBNAILS.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Skills" hint="Comma-separated, used for filtering">
                <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="KYC, Customer registration" />
              </Field>
            </div>
            {(form.type === 'LINK' || form.type === 'VIDEO') && (
              <div className="sm:col-span-2">
                <Field label={form.type === 'VIDEO' ? 'Stream URL' : 'External URL'} hint={form.type === 'VIDEO' ? 'YouTube, Vimeo or SharePoint / Stream link — videos always stream, never download (D4)' : undefined}>
                  <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={form.type === 'VIDEO' ? 'https://www.youtube.com/watch?v=…' : 'https://…'} />
                </Field>
                {form.type === 'VIDEO' && form.url.trim() && (
                  <p className={'mt-1.5 text-xs ' + (videoSource(form.url).kind === 'none' ? 'text-brand-600' : 'text-mpesa-700')}>
                    {(() => {
                      const v = videoSource(form.url)
                      return v.kind === 'none' ? 'Not a recognised video link — use YouTube, Vimeo, SharePoint / Stream or an .mp4 file.' : 'Plays as an embedded ' + v.label + ' video.'
                    })()}
                  </p>
                )}
              </div>
            )}
            {form.type === 'DOCUMENT' && (
              <Field label="Minimum reading time (seconds)" hint="Learner must wait this long before completing">
                <Input type="number" min={0} value={form.minViewSeconds} onChange={(e) => setForm({ ...form, minViewSeconds: e.target.value })} />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            {!material && acceptsFile && (
              <div className="space-y-3 sm:col-span-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept={fileAccept}
                  className="hidden"
                  aria-label="Attach material file"
                  onChange={(event) => {
                    setUploadedFile(event.currentTarget.files?.[0] ?? null)
                    event.currentTarget.value = ''
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-800">Attach {form.type === 'PRESENTATION' ? 'presentation' : 'document'}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{fileAccept.replaceAll('.', '').replaceAll(',', ', ').toUpperCase()}</span>
                  </span>
                  <Button type="button" onClick={() => fileInput.current?.click()}>
                    <Upload className="size-4" /> {uploadedFile ? 'Replace file' : 'Browse files'}
                  </Button>
                </div>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-surface p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><FileText className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{uploadedFile.name}</span>
                      <span className="block text-xs text-zinc-500">Attached · {formatBytes(uploadedFile.size)}</span>
                    </span>
                    <button type="button" onClick={() => setUploadedFile(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" aria-label="Remove attached file">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Choose a file to attach it to this material. A file is required for documents and presentations.</p>
                )}
              </div>
            )}
          </div>
        </WizardCard>
      )}

      {step === 'access' && (
        <WizardCard icon={Users} title="Access & downloads">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GroupPicker label="Visible to groups" hint="Empty = everyone enrolled" selected={visible} onChange={setVisible} />
            <GroupPicker label="Downloadable by groups" hint={form.type === 'VIDEO' ? 'Not available for videos' : 'Empty = no downloads'} selected={downloadable} onChange={setDownloadable} />
            <div className="sm:col-span-2">
              <Field label="Tagged trainers">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {data.people
                    .filter((p) => p.role === 'Trainer')
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-mpesa-600"
                          checked={trainers.has(p.id)}
                          onChange={(e) => {
                            const next = new Set(trainers)
                            if (e.target.checked) next.add(p.id)
                            else next.delete(p.id)
                            setTrainers(next)
                          }}
                        />
                        {p.name}
                      </label>
                    ))}
                </div>
              </Field>
            </div>
          </div>
        </WizardCard>
      )}

      {step === 'review' && (
        <WizardCard icon={Check} title="Review">
          <dl className="divide-y divide-zinc-100 text-sm">
            {[
              ['Title', form.title.trim() || '—'],
              ['Type', form.type],
              ...(acceptsFile ? [['File', uploadedFile?.name ?? material?.fileName ?? '—']] : []),
              ['Duration', `${form.minutes || 0} min`],
              ['Level', form.level],
              ['Skills', form.skills.trim() || '—'],
              ...(form.url.trim() ? [['Link', form.url.trim()]] : []),
              ['Visible to', groupNames(visible, 'Everyone enrolled')],
              ['Downloads', form.type === 'VIDEO' ? 'Not available for videos' : groupNames(downloadable, 'No downloads')],
              ['Trainers', data.people.filter((p) => trainers.has(p.id)).map((p) => p.name).join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
                <dt className="font-medium text-zinc-500">{k}</dt>
                <dd className="break-words text-zinc-900">{v}</dd>
              </div>
            ))}
          </dl>
          {acceptsFile && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-zinc-900">Attached material preview</p>
              <MaterialAttachmentPreview
                type={form.type}
                title={form.title || 'Material'}
                file={uploadedFile}
                fileId={uploadedFile ? undefined : material?.fileId}
                fileName={uploadedFile?.name ?? material?.fileName}
                fileSize={uploadedFile?.size ?? material?.fileSize}
              />
            </div>
          )}
          {!valid && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">Add a title and duration{!material && acceptsFile && !uploadedFile ? ', then attach a file' : ''} before saving.</p>}
        </WizardCard>
      )}
    </Wizard>
  )
}

function ReplaceFileModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const accept = material.type === 'PRESENTATION' ? '.ppt,.pptx,.pdf' : '.pdf,.doc,.docx,.ppt,.pptx'

  // Everyone learning through a journey that uses this material.
  const audience = () => {
    const journeyIds = new Set(data.journeys.filter((j) => j.modules.some((m) => m.materialIds.includes(material.id))).map((j) => j.id))
    const people = new Set<string>()
    data.trainings.filter((t) => journeyIdsOf(t).some((id) => journeyIds.has(id))).forEach((t) => t.participantIds.forEach((p) => people.add(p)))
    return people.size
  }

  const replace = async () => {
    if (!file || saving) return
    setSaving(true)
    try {
      const fileId = await saveMaterialFile(file)
      const version = material.version + 1
      const now = localISO()
      update(
        (d) => ({
          ...d,
          materials: d.materials.map((m) =>
            m.id === material.id
              ? {
                  ...m,
                  version,
                  fileId,
                  fileName: file.name,
                  fileSize: file.size,
                  updatedAt: now.slice(0, 10),
                  history: [...m.history, { at: now, by: CURRENT_ADMIN, change: `Replaced file with ${file.name} (version ${version})${note.trim() ? ` — ${note.trim()}` : ''}` }],
                }
              : m,
          ),
        }),
        { action: 'Replaced material file', target: material.title, changes: [{ field: 'File', from: `${materialFileName(material)} (v${material.version})`, to: `${file.name} (v${version})` }] },
      )
      const n = audience()
      toast(n > 0 ? `Replaced — ${n} trainees with access notified` : 'Replaced — no active trainings use this material yet')
      onClose()
      if (material.fileId) void deleteMaterialFile(material.fileId).catch(() => undefined)
    } catch {
      toast('The replacement file could not be saved. Try again.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const replacements = material.history.filter((h) => h.change.startsWith('Replaced')).slice().reverse()

  return (
    <Modal
      open
      onClose={onClose}
      title={`Replace file — ${material.title}`}
      description="The material keeps its journeys, trainings, visibility and download settings. Only the file changes."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!file || saving} onClick={replace}>
            <RefreshCw className="size-4" /> {saving ? 'Saving file…' : 'Replace file'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-900">{materialFileName(material)}</span>
            <span className="block text-xs text-zinc-500">
              Current · version {material.version}
              {material.fileSize ? ` · ${formatBytes(material.fileSize)}` : ''}
            </span>
          </span>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
          <RefreshCw className="size-6 text-brand-600" />
          {file ? (
            <span className="text-sm">
              <span className="font-semibold text-zinc-900">{file.name}</span>
              <span className="block text-xs text-zinc-500">{formatBytes(file.size)} · becomes version {material.version + 1}</span>
            </span>
          ) : (
            <span className="text-sm text-zinc-600">
              <span className="font-semibold text-brand-600">Choose the new file</span>
              <span className="block text-xs text-zinc-500">{accept.replaceAll(',', ', ')}</span>
            </span>
          )}
          <input type="file" accept={accept} className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.currentTarget.value = '' }} />
        </label>
        <Field label="What changed? (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated tariff table for October" />
        </Field>
        {replacements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-zinc-500">Version history</p>
            <ul className="mt-2 space-y-1.5">
              {replacements.slice(0, 5).map((h) => (
                <li key={h.at + h.change} className="flex gap-2 text-xs text-zinc-600">
                  <span className="shrink-0 text-zinc-400">{h.at.slice(0, 10)}</span>
                  <span className="min-w-0">{h.change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-zinc-500">The attached file is saved in this browser and is available to learners with download access.</p>
      </div>
    </Modal>
  )
}

export function AssignMaterialModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [groupIds, setGroupIds] = useState<string[]>(material.assignedGroupIds ?? [])
  const [personIds, setPersonIds] = useState<string[]>(material.assignedPersonIds ?? [])
  const [personSearch, setPersonSearch] = useState('')
  const [dueDate, setDueDate] = useState(material.dueDate ?? '')
  const [requiresAck, setRequiresAck] = useState(material.requiresAck ?? true)
  const reach = assignedPeople(data, { ...material, assignedGroupIds: groupIds, assignedPersonIds: personIds }).length
  const people = data.people
    .filter((person) => person.role === 'Participant' && person.status === 'Active')
    .filter((person) => `${person.name} ${person.email} ${person.department}`.toLowerCase().includes(personSearch.trim().toLowerCase()))
  const hasRecipients = groupIds.length > 0 || personIds.length > 0

  const save = () => {
    const at = localISO()
    update(
      (d) => ({
        ...d,
        materials: d.materials.map((m) =>
          m.id === material.id
            ? { ...m, assignedGroupIds: groupIds, assignedPersonIds: personIds, dueDate: dueDate || undefined, requiresAck, assignedAt: hasRecipients ? (m.assignedAt ?? at) : undefined }
            : m,
        ),
      }),
      {
        action: hasRecipients ? 'Assigned reading' : 'Cleared reading assignment',
        target: material.title,
        changes: [
          { field: 'Groups', from: String(material.assignedGroupIds?.length ?? 0), to: String(groupIds.length) },
          { field: 'Individual users', from: String(material.assignedPersonIds?.length ?? 0), to: String(personIds.length) },
        ],
      },
    )
    toast(hasRecipients ? `Assigned to ${reach} ${reach === 1 ? 'person' : 'people'} — they’ll see it under Assigned to me` : 'Assignment cleared')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign reading — ${material.title}`}
      description="Send this material to groups or individual users for self-paced reading, without scheduling a training."
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{hasRecipients ? `Reaches ${reach} ${reach === 1 ? 'person' : 'people'}` : 'No groups or users selected'}</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {hasRecipients ? 'Assign' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Groups</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {data.groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={groupIds.includes(g.id)}
                  onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((id) => id !== g.id))}
                />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-zinc-700">Individual users</p>
            <p className="mt-0.5 text-xs text-zinc-500">Assign directly to active users without adding a group.</p>
          </div>
          <SearchInput value={personSearch} onChange={setPersonSearch} placeholder="Search users by name, email or department" className="w-full" />
          <div className="max-h-48 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
            {people.map((person) => (
              <label key={person.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-50">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-brand-600"
                  checked={personIds.includes(person.id)}
                  onChange={(event) => setPersonIds(event.target.checked ? [...personIds, person.id] : personIds.filter((id) => id !== person.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{person.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{person.email}{person.department ? ` · ${person.department}` : ''}</span>
                </span>
              </label>
            ))}
            {!people.length && <p className="px-3 py-5 text-center text-sm text-zinc-500">No active users match that search.</p>}
          </div>
        </div>
        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 p-3 text-sm">
          <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            <span className="font-medium text-zinc-900">Ask for an acknowledgement</span>
            <span className="block text-xs text-zinc-500">Each person confirms “I have read and understood this”. Turn off for plain sharing — opening it then counts as done.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}

export function AdminMaterials() {
  const { data, update } = useAdmin()
  const { toast, confirm } = useFeedback()
  const scope = useScope()
  // Trainers edit only materials they're tagged on; everything else is view-only for them (C02).
  const canEdit = (m: Material) => !scope.trainerId || m.taggedTrainerIds.includes(scope.trainerId)
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [level, setLevel] = useState<'ALL' | TrainingLevel>('ALL')
  const [skill, setSkill] = useState('ALL')
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [replacing, setReplacing] = useState<Material | null>(null)
  const [assigning, setAssigning] = useState<Material | null>(null)
  const [preview, setPreview] = useState<Material | null>(null)

  const allSkills = [...new Set(data.materials.flatMap((m) => m.skills))].sort()
  const rows = data.materials.filter(
    (m) =>
      (type === 'ALL' || m.type === type) &&
      (level === 'ALL' || m.level === level) &&
      (skill === 'ALL' || m.skills.includes(skill)) &&
      (!q || m.title.toLowerCase().includes(q.toLowerCase()) || m.skills.some((s) => s.toLowerCase().includes(q.toLowerCase()))),
  )
  const usage = (id: string) => data.journeys.filter((j) => j.modules.some((m) => m.materialIds.includes(id))).length

  const download = async (m: Material) => {
    if (!(await downloadMaterial(m))) return toast('This material has no file or link yet', { tone: 'error' })
    if (canDownloadFile(m)) {
      update((d) => countDownload(d, m.id), { action: 'Downloaded material', target: m.title, silent: true })
      toast(`Downloaded ${materialFileName(m)}`)
    }
  }

  const remove = async (m: Material) => {
    if (!(await confirm({ title: `Delete ${m.title}?`, message: 'It is removed from every journey that uses it. This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return
    update(
      (d) => ({
        ...d,
        materials: d.materials.filter((x) => x.id !== m.id),
        journeys: d.journeys.map((j) => ({ ...j, modules: j.modules.map((mod) => ({ ...mod, materialIds: mod.materialIds.filter((x) => x !== m.id) })) })),
      }),
      { action: 'Deleted material', target: m.title },
    )
  }

  return (
    <>
      <PageHeader
        title="Materials"
        description={scope.trainerId ? 'You can edit materials you’re tagged on; others are view-only.' : 'Documents, videos and presentations used in journeys.'}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add material
          </Button>
        }
      />
      <TabBar>
        <div className="w-full min-w-0 sm:flex-1">
          <Tabs<TypeFilter>
            value={type}
            onChange={setType}
            items={(['ALL', 'DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as TypeFilter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase() }))}
          />
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Select value={level} onChange={(e) => setLevel(e.target.value as 'ALL' | TrainingLevel)} className="w-auto py-1.5 text-xs">
            <option value="ALL">All levels</option>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </Select>
          <Select value={skill} onChange={(e) => setSkill(e.target.value)} className="w-auto py-1.5 text-xs">
            <option value="ALL">All skills</option>
            {allSkills.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search materials…" className="w-full sm:w-64" />
        </div>
      </TabBar>
      <Table head={['Title', 'Type', 'Level', 'Skills', 'Duration', 'Used in', 'Assigned', 'Version', 'Updated', '']} minWidth={1040}>
        {rows.map((m) => {
          const Icon = materialIcon[m.type]
          return (
            <tr key={m.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900">{m.title}</span>
                    <span className="line-clamp-1 text-xs text-zinc-500">
                      {canDownloadFile(m) ? `${materialFileName(m)}${m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ''}` : m.description}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge>{m.type}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">{m.level ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex max-w-48 flex-wrap gap-1">
                  {m.skills.length ? m.skills.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-zinc-400">—</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-600">{m.minutes} mins</td>
              <td className="px-4 py-3 text-zinc-600">{usage(m.id)} journeys</td>
              <td className="px-4 py-3 text-zinc-600">
                <div className="flex flex-wrap gap-1">
                  {!!m.assignedGroupIds?.length && <Badge tone="green">{m.assignedGroupIds.length} group{m.assignedGroupIds.length === 1 ? '' : 's'}</Badge>}
                  {!!m.assignedPersonIds?.length && <Badge>{m.assignedPersonIds.length} user{m.assignedPersonIds.length === 1 ? '' : 's'}</Badge>}
                  {!m.assignedGroupIds?.length && !m.assignedPersonIds?.length && <span className="text-zinc-400">—</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-600">v{m.version}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{m.updatedAt}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {!canEdit(m) && <Badge>View only</Badge>}
                  <RowMenu
                    label={`Actions for ${m.title}`}
                    items={[
                      { label: 'Preview', icon: Eye, onClick: () => setPreview(m) },
                      ...(canDownloadFile(m) || m.url ? [{ label: canDownloadFile(m) ? 'Download file' : 'Open source', icon: canDownloadFile(m) ? Download : ExternalLink, onClick: () => void download(m) }] : []),
                      ...(canEdit(m)
                        ? [
                            ...(canDownloadFile(m) ? [{ label: 'Assign material', icon: UserPlus, onClick: () => setAssigning(m) }] : []),
                            { label: 'Edit details', icon: Pencil, onClick: () => setEditing(m) },
                            ...(canDownloadFile(m) ? [{ label: 'Replace file', icon: RefreshCw, onClick: () => setReplacing(m) }] : []),
                            ...(!scope.trainerId ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => void remove(m) }] : []),
                          ]
                        : []),
                    ]}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </Table>
      {!rows.length && (
        <Card className="mt-4">
          <Empty
            icon={FileText}
            title={data.materials.length ? 'No materials match these filters' : 'No materials yet'}
            text={data.materials.length ? 'Try another type, level, skill or search.' : 'Add documents, videos and presentations to use in journeys.'}
          />
        </Card>
      )}
      {editing && <MaterialModal material={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {replacing && <ReplaceFileModal material={replacing} onClose={() => setReplacing(null)} />}
      {assigning && <AssignMaterialModal material={assigning} onClose={() => setAssigning(null)} />}
      <MaterialPreview material={preview} onClose={() => setPreview(null)} />
    </>
  )
}
