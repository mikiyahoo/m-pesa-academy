import { ArrowDown, ArrowUp, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, Download, ExternalLink, Eye, FileText, Layers, Lock, LockOpen, Pencil, Plus, RefreshCw, Route, Trash2, Upload, UserPlus, UserRound, Users, X } from 'lucide-react'
import { RowMenu } from '../../components/RowMenu'
import { canDownloadFile, countDownload, deleteMaterialFile, downloadMaterial, formatBytes, getMaterialFile, materialFileName, saveMaterialFile } from '../materialFiles'
import { assignedPeople } from '../../lib/assignments'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO } from '../../lib/utils'
import { MaterialPreview, materialIcon } from '../MaterialPreview'
import { MaterialAttachmentPreview } from '../MaterialAttachmentPreview'
import { SelectMenu } from '../../components/Pickers'
import { useScope } from '../scope'
import { videoSource } from '../embeds'
import { uid, useAdmin } from '../store'
import type { Journey, Material, MaterialType, TrainingLevel } from '../types'
import { Badge, Button, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Tabs, Textarea } from '../ui'
import { Wizard, WizardCard, type WizardStep } from '../Wizard'
import { journeyIdsOf } from '../journeys'

const LEVELS: TrainingLevel[] = ['Novice', 'Beginner', 'Intermediate', 'Advanced']
const THUMBNAILS = ['red', 'fayda', 'green', 'blue', 'amber', 'zinc'] as const
const CURRENT_ADMIN = 'Fasil Wolde'

const thumbnailStyles: Record<(typeof THUMBNAILS)[number], string> = {
  red: 'from-brand-700 via-brand-600 to-rose-400',
  fayda: 'from-amber-400 via-brand-500 to-mpesa-500',
  green: 'from-mpesa-700 to-emerald-400',
  blue: 'from-sky-700 to-blue-400',
  amber: 'from-amber-600 to-yellow-300',
  zinc: 'from-zinc-700 to-zinc-400',
}

const compactTone: Record<MaterialType, string> = {
  DOCUMENT: 'bg-brand-50 text-brand-600',
  PRESENTATION: 'bg-mpesa-500/10 text-mpesa-700',
  VIDEO: 'bg-amber-500/10 text-amber-700',
  LINK: 'bg-zinc-100 text-zinc-700',
}
function automaticThumbnail(type: MaterialType, fileName = ''): (typeof THUMBNAILS)[number] {
  const extension = fileName.split('.').at(-1)?.toLowerCase()
  if (type === 'VIDEO') return 'blue'
  if (type === 'LINK') return 'green'
  if (type === 'PRESENTATION' || ['ppt', 'pptx', 'pps', 'ppsx', 'odp', 'key'].includes(extension ?? '')) return 'fayda'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension ?? '')) return 'green'
  return 'red'
}

function MaterialThumbnail({ type, title, source, color, thumbnailFile, thumbnailFileId, compact = false }: { type: MaterialType; title: string; source: string; color: (typeof THUMBNAILS)[number]; thumbnailFile?: File | null; thumbnailFileId?: string; compact?: boolean }) {
  const Icon = materialIcon[type]
  const [imageUrl, setImageUrl] = useState<string>()
  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setImageUrl(undefined)
    const load = async () => {
      if (thumbnailFile) {
        objectUrl = URL.createObjectURL(thumbnailFile)
        if (active) setImageUrl(objectUrl)
        return
      }
      if (!thumbnailFileId) return
      try {
        const stored = await getMaterialFile(thumbnailFileId)
        if (!active || !stored) return
        objectUrl = URL.createObjectURL(stored.blob)
        setImageUrl(objectUrl)
      } catch {
        // Keep the generated cover if the saved image cannot be loaded.
      }
    }
    void load()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [thumbnailFile, thumbnailFileId])
  // Table rows: a soft tinted tile in the app palette, like material rows elsewhere.
  if (compact)
    return (
      <span role="img" aria-label={`${type.toLowerCase()} material`} className={cn('relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl', compactTone[type])}>
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        {!imageUrl && <Icon className="size-[18px]" />}
      </span>
    )
  return (
    <div role="img" aria-label={`${type.toLowerCase()} thumbnail preview${title ? ` for ${title}` : ''}`} className={cn('relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br p-3 text-white shadow-inner', thumbnailStyles[color], compact ? 'size-10 p-2' : 'aspect-video w-44')}>
      {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      {imageUrl && <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" aria-hidden />}
      <span className="absolute -right-5 -bottom-7 size-24 rounded-full bg-white/15" aria-hidden />
      <span className="relative flex items-center justify-between gap-2">
        <Icon className={compact ? 'size-4' : 'size-6'} />
        {!compact && <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide">{type}</span>}
      </span>
      {!compact && <span className="relative min-w-0"><span className="block truncate text-xs font-bold">{title || 'Material title'}</span><span className="mt-0.5 block truncate text-[10px] text-white/80">{source || 'Preview updates from the attached material'}</span></span>}
    </div>
  )
}

/* ---------------------------------- Journeys --------------------------------- */


/** Files a material can be: documents, slide decks, spreadsheets and plain text. */
const MATERIAL_FILE_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.pps,.ppsx,.odp,.key,.xls,.xlsx,.csv,.odt,.ods,.rtf,.txt'
/** Short version for upload boxes: the common types, the rest as + more. */
const MATERIAL_FILE_HINT = 'PDF, Word, PowerPoint, Excel + more'

function NewJourneyModal({ onClose, journey }: { onClose: () => void; journey?: Journey }) {
  const { update } = useAdmin()
  const navigate = useNavigate()
  const [name, setName] = useState(journey?.name ?? '')
  const [description, setDescription] = useState(journey?.description ?? '')
  const [startDate, setStartDate] = useState(journey?.startDate ?? '')
  const [endDate, setEndDate] = useState(journey?.endDate ?? '')
  const save = () => {
    const details = { name: name.trim(), description: description.trim(), startDate: startDate || undefined, endDate: endDate || undefined }
    if (journey) {
      update((d) => ({ ...d, journeys: d.journeys.map((x) => (x.id === journey.id ? { ...x, ...details } : x)) }), { action: 'Updated journey', target: details.name })
    } else {
      const j: Journey = { id: uid('j'), ...details, modules: [] }
      update((d) => ({ ...d, journeys: [...d.journeys, j] }), { action: 'Created journey', target: j.name })
      // Straight on to adding its modules.
      onClose()
      navigate(`/admin/journeys/${j.id}?new=1`)
      return
    }
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={journey ? 'Edit journey' : 'New journey'}
      description="A journey is an ordered set of modules that trainings follow."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            {journey ? 'Save changes' : 'Create journey'}
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
  const { data, update } = useAdmin()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Journey | null>(null)

  const duplicate = (j: Journey) => {
    const copy: Journey = { ...j, id: uid('j'), name: `${j.name} (copy)`, modules: j.modules.map((m) => ({ ...m, id: uid('jm') })) }
    update((d) => ({ ...d, journeys: [...d.journeys, copy] }), { action: 'Duplicated journey', target: copy.name })
  }
  // A journey used by trainings can't be deleted — those trainings would lose their modules.
  const remove = async (j: Journey, used: number) => {
    if (used) {
      toast(`“${j.name}” is used by ${used} training${used === 1 ? '' : 's'}. Remove it from them first.`, { tone: 'error' })
      return
    }
    if (!(await confirm({ title: `Delete “${j.name}”?`, message: 'Its modules are removed. Materials stay in the library.', confirmLabel: 'Delete journey' }))) return
    update((d) => ({ ...d, journeys: d.journeys.filter((x) => x.id !== j.id) }), { action: 'Deleted journey', target: j.name })
  }
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
            <div key={j.id} className="group relative rounded-2xl border border-zinc-200/80 bg-surface transition hover:border-zinc-300 hover:shadow-md">
              <div className="absolute top-4 right-4 z-10">
                <RowMenu
                  label={`Actions for ${j.name}`}
                  items={[
                    { label: 'Open', icon: Eye, onClick: () => navigate(`/admin/journeys/${j.id}`), primary: true },
                    { label: 'Edit details', icon: Pencil, onClick: () => setEditing(j) },
                    { label: 'Duplicate', icon: Copy, onClick: () => duplicate(j) },
                    { label: used ? `Delete (used by ${used})` : 'Delete', icon: Trash2, onClick: () => void remove(j, used), danger: true },
                  ]}
                />
              </div>
              <Link to={`/admin/journeys/${j.id}`} className="block p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <BookOpen className="size-5" />
              </span>
              <h3 className="mt-4 pr-8 font-bold text-zinc-900 group-hover:text-brand-600">{j.name}</h3>
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
            </div>
          )
        })}
      </div>
      {creating && <NewJourneyModal onClose={() => setCreating(false)} />}
      {editing && <NewJourneyModal journey={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function AdminJourneyDetail() {
  const { id = '' } = useParams()
  const { data, update } = useAdmin()
  const journey = data.journeys.find((j) => j.id === id)
  const [newModule, setNewModule] = useState('')
  // Arriving from "Create journey": the module title box is ready to type into.
  const justCreated = new URLSearchParams(window.location.search).has('new')
  const [preview, setPreview] = useState<Material | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)

  if (!journey) return <Empty icon={BookOpen} title="Journey not found" />

  const save = (modules: Journey['modules'], action: string) =>
    update((d) => ({ ...d, journeys: d.journeys.map((j) => (j.id === journey.id ? { ...j, modules } : j)) }), { action, target: journey.name })

  const patch = (changes: Partial<Journey>, action: string) =>
    update((d) => ({ ...d, journeys: d.journeys.map((j) => (j.id === journey.id ? { ...j, ...changes } : j)) }), { action, target: journey.name })

  const move = (i: number, dir: -1 | 1) => moveTo(i, i + dir)
  // Typing a position moves the module straight there.
  const moveTo = (from: number, to: number) => {
    const target = Math.min(Math.max(to, 0), journey.modules.length - 1)
    if (target === from) return
    const next = [...journey.modules]
    const [m] = next.splice(from, 1)
    next.splice(target, 0, m)
    save(next, 'Reordered modules')
  }

  const addModule = () => {
    const title = newModule.trim()
    if (!title) return
    save([...journey.modules, { id: uid('m'), title, materialIds: [] }], `Added module ${title}`)
    setNewModule('')
  }
  const toggleCollapsed = (mid: string) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(mid)) next.delete(mid)
      else next.add(mid)
      return next
    })
  const rename = (mid: string, title: string) => {
    const m = journey.modules.find((x) => x.id === mid)
    setRenaming(null)
    if (!m || !title.trim() || title.trim() === m.title) return
    save(journey.modules.map((x) => (x.id === mid ? { ...x, title: title.trim() } : x)), `Renamed module ${m.title}`)
  }

  return (
    <>
      <PageHeader title={<>{journey.name} <Badge>JOURNEY</Badge></>} description={journey.description} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          addModule()
        }}
        className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-surface p-5 lg:flex-row lg:items-end"
      >
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" value={journey.startDate ?? ''} max={journey.endDate} onChange={(e) => patch({ startDate: e.target.value || undefined }, 'Set journey start date')} className="sm:w-44" />
          </Field>
          <Field label="End date">
            <Input type="date" value={journey.endDate ?? ''} min={journey.startDate} onChange={(e) => patch({ endDate: e.target.value || undefined }, 'Set journey end date')} className="sm:w-44" />
          </Field>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label="New module">
              <Input value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="Write a module title…" aria-label="New module title" autoFocus={justCreated} />
            </Field>
          </div>
          <button
            type="submit"
            disabled={!newModule.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-500 px-5 text-sm font-semibold whitespace-nowrap text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent"
          >
            <Plus className="size-4" /> Add module
          </button>
        </div>
      </form>

      <div className="mb-3">
        <h2 className="text-lg font-bold text-zinc-900">Journey modules</h2>
      </div>
      {journey.modules.length === 0 && <Empty icon={Layers} title="No modules yet" text="Write a module title above and click Add module." />}
      <div>
        {journey.modules.map((m, i) => {
          const available = data.materials.filter((x) => !m.materialIds.includes(x.id))
          const materials = m.materialIds.map((mid) => data.materials.find((x) => x.id === mid)).filter((x): x is Material => !!x)
          // Nothing to hide in an empty module: it always shows "Add material".
          const isCollapsed = collapsed.has(m.id) && materials.length > 0
          return (
            <div key={m.id} className="relative flex gap-3 pb-5 last:pb-0 sm:gap-5">
              {/* Timeline: numbered step joined to the next one. */}
              <div className="relative flex w-11 shrink-0 justify-center sm:w-14">
                {i < journey.modules.length - 1 && <span className="absolute top-[70px] -bottom-[42px] left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-zinc-300" aria-hidden />}
                <span className="relative mt-[22px] grid size-11 place-items-center rounded-full border border-brand-200 bg-brand-50 text-base font-bold text-brand-600 shadow-md ring-[5px] ring-surface sm:size-12 sm:text-lg">{String(i + 1).padStart(2, '0')}</span>
              </div>
            <section className="relative min-w-0 flex-1 rounded-2xl border border-zinc-200/80 bg-surface p-5">
              {/* Arrow from the card to its step number. */}
              <span className="absolute top-[36px] -left-[7px] size-3.5 rotate-45 border-b border-l border-zinc-200/80 bg-surface sm:top-[38px]" aria-hidden />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex min-w-48 flex-1 flex-wrap items-center gap-2">
                  {renaming === m.id ? (
                    <input
                      autoFocus
                      defaultValue={m.title}
                      aria-label="Module title"
                      onBlur={(e) => rename(m.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-brand-500 bg-surface px-2 py-1 text-base font-bold text-zinc-900 ring-2 ring-brand-100 outline-none"
                    />
                  ) : (
                    <h3 className="text-base font-bold text-zinc-900">{m.title}</h3>
                  )}
                  <Badge tone={m.skippable ? 'amber' : 'green'}>{m.skippable ? 'OPTIONAL' : 'REQUIRED'}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="block w-64 max-w-full">
                    <span className="mb-1 block text-xs font-semibold text-zinc-600">Assessment</span>
                    <Select
                      value={m.assessmentId ?? ''}
                      onChange={(e) => save(journey.modules.map((x) => (x.id === m.id ? { ...x, assessmentId: e.target.value || undefined } : x)), `Set assessment for ${m.title}`)}
                      aria-label={`Assessment for ${m.title}`}
                      className="text-xs"
                    >
                      <option value="">None</option>
                      {data.assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="flex items-center gap-1" role="group" aria-label={`Position of ${m.title}`}>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="grid size-9 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:text-zinc-700">
                      <ArrowUp className="size-4" />
                    </button>
                    <input
                      key={`${m.id}-${i}`}
                      type="number"
                      min={1}
                      max={journey.modules.length}
                      defaultValue={i + 1}
                      aria-label={`Move ${m.title} to position`}
                      title="Type a position and press Enter"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
                      onBlur={(e) => {
                        const n = Number(e.target.value)
                        if (Number.isFinite(n) && n >= 1) moveTo(i, Math.round(n) - 1)
                        else e.target.value = String(i + 1)
                      }}
                      className="h-9 w-10 rounded-lg border border-zinc-200 bg-surface text-center text-sm font-bold text-zinc-900 outline-none [appearance:textfield] focus:border-brand-500 focus:ring-2 focus:ring-brand-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button type="button" disabled={i === journey.modules.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="grid size-9 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:text-zinc-700">
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => save(journey.modules.map((x) => (x.id === m.id ? { ...x, skippable: !m.skippable || undefined } : x)), m.skippable ? `Made ${m.title} required` : `Made ${m.title} optional`)}
                    aria-pressed={!m.skippable}
                    title={m.skippable ? 'Optional: learners can skip it. Click to make it required.' : 'Required: must be finished before the next module. Click to make it optional.'}
                    className={cn(
                      'inline-flex h-9 w-28 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
                      m.skippable ? 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-400' : 'text-zinc-800 hover:bg-zinc-100',
                    )}
                  >
                    {m.skippable ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                    {m.skippable ? 'Optional' : 'Required'}
                  </button>
                  <RowMenu
                    label={`Actions for ${m.title}`}
                    items={[
                      { label: 'Rename', icon: Pencil, onClick: () => setRenaming(m.id) },
                      { label: m.skippable ? 'Make required' : 'Make optional', icon: m.skippable ? Lock : LockOpen, onClick: () => save(journey.modules.map((x) => (x.id === m.id ? { ...x, skippable: !m.skippable || undefined } : x)), m.skippable ? `Made ${m.title} required` : `Made ${m.title} optional`) },
                      { label: 'Delete module', icon: Trash2, danger: true, onClick: () => save(journey.modules.filter((x) => x.id !== m.id), `Deleted module ${m.title}`) },
                    ]}
                  />
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-4 space-y-2">
                  {materials.map((mat) => {
                    const Icon = materialIcon[mat.type]
                    return (
                      <div key={mat.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-100/60">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-surface text-zinc-600">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-900">{mat.title}</span>
                          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                            {mat.type} • {mat.minutes} min{mat.level ? ` • ${mat.level}` : ''}
                          </span>
                        </span>
                        <button type="button" onClick={() => setPreview(mat)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-surface hover:text-brand-600">
                          <Eye className="size-4" /> Preview
                        </button>
                        <span className="h-6 w-px bg-zinc-200" aria-hidden />
                        <button
                          type="button"
                          onClick={() => save(journey.modules.map((x) => (x.id === m.id ? { ...x, materialIds: x.materialIds.filter((y) => y !== mat.id) } : x)), `Removed material from ${m.title}`)}
                          className="grid size-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-brand-50 hover:text-brand-600"
                          aria-label={`Remove ${mat.title}`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )
                  })}
                  {materials.length === 0 && <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-xs text-zinc-500">No materials yet. Add one below.</p>}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                {!isCollapsed && available.length > 0 && (
                  <div className="w-48">
                    <SelectMenu
                      value=""
                      onChange={(e) => save(journey.modules.map((x) => (x.id === m.id ? { ...x, materialIds: [...x.materialIds, e.target.value] } : x)), `Added material to ${m.title}`)}
                      aria-label={`Add material to ${m.title}`}
                      className="rounded-full font-semibold"
                    >
                      <option value="">+ Add material</option>
                      {available.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                    </SelectMenu>
                  </div>
                )}
                {isCollapsed && (
                  <span className="text-xs font-medium text-zinc-500">
                    {materials.length} material{materials.length === 1 ? '' : 's'} hidden
                  </span>
                )}
                {materials.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(m.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Show materials of ${m.title}` : `Hide materials of ${m.title}`}
                  title={isCollapsed ? 'Show materials' : 'Hide materials'}
                  className="ml-auto grid size-9 place-items-center rounded-full text-brand-600 transition hover:bg-brand-50"
                >
                  <ChevronUp className={cn('size-5 transition-transform', isCollapsed && 'rotate-180')} />
                </button>
                )}
              </div>
            </section>
            </div>
          )
        })}
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

function SkillTagInput({ values, onChange }: { values: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value) return
    if (!values.some((skill) => skill.toLowerCase() === value.toLowerCase())) onChange([...values, value])
    setDraft('')
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 bg-surface px-3 py-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      {values.map((skill) => (
        <span key={skill} className="inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1 pl-2.5 text-xs font-medium text-zinc-700">
          <span className="truncate">{skill}</span>
          <button type="button" onClick={() => onChange(values.filter((item) => item !== skill))} aria-label={`Remove ${skill}`} className="grid size-5 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        placeholder={values.length ? '' : 'Type a skill'}
        aria-label="Add a skill"
        className="min-w-24 flex-1 bg-transparent py-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
      />
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
    skills: material?.skills ?? [],
    thumbnail: material?.thumbnail ?? automaticThumbnail(material?.type ?? 'DOCUMENT', material?.fileName),
    minViewSeconds: String(material?.minViewSeconds ?? 300),
    url: material?.url ?? '',
  })
  const [visible, setVisible] = useState<Set<string>>(new Set(material?.visibleGroupIds))
  const [downloadable, setDownloadable] = useState<Set<string>>(new Set(material?.downloadableGroupIds))
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedThumbnail, setUploadedThumbnail] = useState<File | null>(null)
  const [clearSavedThumbnail, setClearSavedThumbnail] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const thumbnailInput = useRef<HTMLInputElement>(null)
  const scope = useScope()
  // A trainer adding material is tagged on it automatically so they can keep editing it.
  const [trainers, setTrainers] = useState<Set<string>>(new Set(material?.taggedTrainerIds ?? (scope.trainerId ? [scope.trainerId] : [])))
  const acceptsFile = form.type === 'DOCUMENT' || form.type === 'PRESENTATION'
  // Any common learning file; picking a slide deck switches the type to Presentation.
  const fileAccept = MATERIAL_FILE_TYPES
  const valid = !!form.title.trim() && Number(form.minutes) > 0 && (!!material || !acceptsFile || !!uploadedFile)
  const [step, setStep] = useState<MaterialStep>('details')

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const now = localISO()
      const fileId = uploadedFile ? await saveMaterialFile(uploadedFile) : material?.fileId
      const thumbnailFileId = uploadedThumbnail ? await saveMaterialFile(uploadedThumbnail) : clearSavedThumbnail ? undefined : material?.thumbnailFileId
      const next: Material = {
        id: material?.id ?? uid('mat'),
        title: form.title.trim(),
        type: form.type,
        minutes: Number(form.minutes),
        description: form.description.trim(),
        updatedAt: now.slice(0, 10),
        level: form.level,
        skills: form.skills,
        thumbnail: form.thumbnail,
        thumbnailFileId,
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
      if (material?.thumbnailFileId && material.thumbnailFileId !== thumbnailFileId) void deleteMaterialFile(material.thumbnailFileId).catch(() => undefined)
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[12fr_5fr_3fr]">
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(e) => {
                  const type = e.target.value as MaterialType
                  setUploadedFile(null)
                  setForm((current) => ({ ...current, type, thumbnail: automaticThumbnail(type) }))
                }}>
                  {(['DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as MaterialType[]).map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Duration (min)">
                <Input type="number" min={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Difficulty level">
                <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as TrainingLevel })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </Select>
              </Field>
              {form.type === 'DOCUMENT' && (
                <Field label="Minimum reading time (sec)">
                  <Input type="number" min={0} value={form.minViewSeconds} onChange={(e) => setForm({ ...form, minViewSeconds: e.target.value })} />
                </Field>
              )}
            </div>
            <div>
              <Field label="Skills">
                <SkillTagInput values={form.skills} onChange={(skills) => setForm((current) => ({ ...current, skills }))} />
              </Field>
            </div>
            {(form.type === 'LINK' || form.type === 'VIDEO') && (
              <div>
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
            <div>
              <Field label="Description">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            {!material && acceptsFile && (
              <div className="space-y-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept={fileAccept}
                  className="hidden"
                  aria-label="Attach material file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null
                    setUploadedFile(file)
                    if (file) {
                      const type = /\.(pptx?|odp|key)$/i.test(file.name) ? 'PRESENTATION' : /\.(pdf|docx?|xlsx?|csv|txt|rtf|odt|ods)$/i.test(file.name) ? 'DOCUMENT' : form.type
                      setForm((current) => ({ ...current, type, thumbnail: automaticThumbnail(type, file.name) }))
                    }
                    event.currentTarget.value = ''
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-800">Attach {form.type === 'PRESENTATION' ? 'presentation' : 'document'}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">PDF, Word, PowerPoint, Excel, CSV, text and OpenDocument files</span>
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
                    <button type="button" onClick={() => {
                      setUploadedFile(null)
                      setForm((current) => ({ ...current, thumbnail: automaticThumbnail(current.type) }))
                    }} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700" aria-label="Remove attached file">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            <Field label="Thumbnail preview">
              <input
                ref={thumbnailInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Upload a custom thumbnail image"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null
                  if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    toast('Choose a JPG, PNG or WebP image.', { tone: 'error' })
                  } else if (file && file.size > 8 * 1024 * 1024) {
                    toast('Choose an image smaller than 8 MB.', { tone: 'error' })
                  } else if (file) {
                    setUploadedThumbnail(file)
                    setClearSavedThumbnail(false)
                  }
                  event.currentTarget.value = ''
                }}
              />
              <div className="flex flex-col items-start gap-2">
                <MaterialThumbnail type={form.type} title={form.title} source={uploadedFile?.name ?? material?.fileName ?? (form.type === 'VIDEO' || form.type === 'LINK' ? form.url : '')} color={form.thumbnail} thumbnailFile={uploadedThumbnail} thumbnailFileId={clearSavedThumbnail ? undefined : material?.thumbnailFileId} />
                <Button type="button" size="sm" onClick={() => thumbnailInput.current?.click()}>
                  <Upload className="size-3.5" /> {uploadedThumbnail || (material?.thumbnailFileId && !clearSavedThumbnail) ? 'Change thumbnail' : 'Upload custom image'}
                </Button>
                {(uploadedThumbnail || (material?.thumbnailFileId && !clearSavedThumbnail)) && (
                  <Button type="button" size="sm" onClick={() => { setUploadedThumbnail(null); setClearSavedThumbnail(true) }}>
                    Use generated preview
                  </Button>
                )}
              </div>
            </Field>
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
          <dl className="grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
            {[
              ['Title', form.title.trim() || '—'],
              ['Type', form.type],
              ...(acceptsFile ? [['File', uploadedFile?.name ?? material?.fileName ?? '—']] : []),
              ['Duration', `${form.minutes || 0} min`],
              ['Level', form.level],
              ...(form.type === 'DOCUMENT' ? [['Minimum reading time', `${form.minViewSeconds || 0} sec`]] : []),
              ['Skills', form.skills.join(', ') || '—'],
              ...(form.url.trim() ? [['Link', form.url.trim()]] : []),
              ...(form.description.trim() ? [['Description', form.description.trim()]] : []),
              ['Visible to', groupNames(visible, 'Everyone enrolled')],
              ['Downloads', form.type === 'VIDEO' ? 'Not available for videos' : groupNames(downloadable, 'No downloads')],
              ['Trainers', data.people.filter((p) => trainers.has(p.id)).map((p) => p.name).join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 border-b border-zinc-100 py-2.5">
                <dt className="mb-1 text-xs font-medium text-zinc-500">{k}</dt>
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
  const accept = MATERIAL_FILE_TYPES

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
              <span className="block text-xs text-zinc-500">{MATERIAL_FILE_HINT}</span>
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
      wide
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
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Groups</p>
          <div className="grid grid-cols-1 gap-1.5">
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
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-zinc-700">Individual users</p>
            <p className="mt-0.5 text-xs text-zinc-500">Assign directly to active users without adding a group.</p>
          </div>
          <SearchInput value={personSearch} onChange={setPersonSearch} placeholder="Search users by name, email or department" className="w-full" />
          <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
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
  // Journey materials sit in journey modules; additional ones are attached to a training outside its journey.
  const [usedAs, setUsedAs] = useState<'ALL' | 'JOURNEY' | 'ADDITIONAL'>('ALL')
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [replacing, setReplacing] = useState<Material | null>(null)
  const [assigning, setAssigning] = useState<Material | null>(null)
  const [preview, setPreview] = useState<Material | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const allSkills = [...new Set(data.materials.flatMap((m) => m.skills))].sort()
  const inJourneys = new Set(data.journeys.flatMap((j) => j.modules.flatMap((m) => m.materialIds)))
  const inTrainings = new Set(data.trainings.flatMap((t) => t.extraMaterialIds ?? []))
  const typeCount = (v: TypeFilter) => v === 'ALL' ? data.materials.length : data.materials.filter((m) => m.type === v).length
  const rows = data.materials.filter(
    (m) =>
      (usedAs === 'ALL' || (usedAs === 'JOURNEY' ? inJourneys.has(m.id) : inTrainings.has(m.id))) &&
      (type === 'ALL' || m.type === type) &&
      (level === 'ALL' || m.level === level) &&
      (skill === 'ALL' || m.skills.includes(skill)) &&
      (!q || `${m.title} ${m.fileName ?? ''} ${m.description} ${m.skills.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())),
  ).sort((a, b) => sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title))
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const firstPageNumber = Math.max(0, Math.min(currentPage - 1, pageCount - 3))
  const pageNumbers = Array.from({ length: Math.min(3, pageCount) }, (_, index) => firstPageNumber + index)
  const usage = (id: string) => data.journeys.filter((j) => j.modules.some((m) => m.materialIds.includes(id))).length
  const trainingUsage = (id: string) => data.trainings.filter((t) => t.extraMaterialIds?.includes(id)).length
  const journeyOnlyUsage = rows.some((m) => usage(m.id) > 0) && rows.every((m) => trainingUsage(m.id) === 0)
  const updatedLabel = (value: string) => {
    const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
  }

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
    if (m.fileId) void deleteMaterialFile(m.fileId).catch(() => undefined)
    if (m.thumbnailFileId) void deleteMaterialFile(m.thumbnailFileId).catch(() => undefined)
    setPage(0)
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
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-surface shadow-card">
        <div className="border-b border-zinc-100 px-3 py-2.5 sm:px-4">
          <Tabs<TypeFilter>
            value={type}
            onChange={(value) => { setType(value); setPage(0) }}
            label="Filter materials by type"
            items={(['ALL', 'DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as TypeFilter[]).map((v) => ({
              value: v,
              label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase(),
              count: typeCount(v),
            }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-zinc-100 p-3 sm:p-4">
          <SearchInput value={q} onChange={(value) => { setQ(value); setPage(0) }} placeholder="Search materials…" className="w-full sm:max-w-[22rem] sm:flex-1" />
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <Select value={usedAs} onChange={(e) => { setUsedAs(e.target.value as 'ALL' | 'JOURNEY' | 'ADDITIONAL'); setPage(0) }} className="w-auto py-1.5 text-xs" aria-label="Material use">
              <option value="ALL">All materials</option>
              <option value="JOURNEY">Journey materials</option>
              <option value="ADDITIONAL">Additional materials</option>
            </Select>
            <Select value={level} onChange={(e) => { setLevel(e.target.value as 'ALL' | TrainingLevel); setPage(0) }} className="w-auto py-1.5 text-xs" aria-label="Filter by level">
              <option value="ALL">All levels</option>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </Select>
            <Select value={skill} onChange={(e) => { setSkill(e.target.value); setPage(0) }} className="w-auto py-1.5 text-xs" aria-label="Filter by skill">
              <option value="ALL">All skills</option>
              {allSkills.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1116px] text-left text-sm">
            <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
              <tr>
                <th className="py-3 pr-3 pl-4">
                  <button type="button" onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center gap-1.5 hover:text-zinc-900">
                    Title {sortDirection === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  </button>
                </th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Level</th>
                <th className="px-3 py-3">Skills</th>
                <th className="px-3 py-3">Duration</th>
                <th className="px-3 py-3">{journeyOnlyUsage ? 'Journey' : 'Used in'}</th>
                <th className="px-3 py-3">Assigned</th>
                <th className="px-3 py-3">Updated</th>
                <th className="w-12 px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/90 text-zinc-800">
              {visibleRows.map((m) => {
                const TypeIcon = materialIcon[m.type]
                const journeys = usage(m.id)
                const trainingsUsed = trainingUsage(m.id)
                const groups = m.assignedGroupIds?.length ?? 0
                const individuals = m.assignedPersonIds?.length ?? 0
                const assignedLabel = groups && individuals ? `${groups} groups · ${individuals} users` : groups ? `${groups} group${groups === 1 ? '' : 's'}` : individuals ? `${individuals} user${individuals === 1 ? '' : 's'}` : ''
                return (
                  <tr key={m.id} className="transition-colors hover:bg-zinc-50/80">
                    <td className="py-1.5 pr-3 pl-4">
                      <div className="min-w-0">
                        <span className="block min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="block truncate font-medium text-zinc-900">{m.title}</span>
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">v{m.version}</span>
                          </span>
                          <span className="block truncate text-xs text-zinc-500" title={materialFileName(m) || m.description}>
                            {canDownloadFile(m) ? `${materialFileName(m)}${m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ''}` : m.description || m.url}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', compactTone[m.type])}>
                        <TypeIcon className="size-3.5 shrink-0" />
                        {m.type === 'DOCUMENT' ? 'DOC' : m.type[0] + m.type.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{m.level ? <Badge tone="blue" className="normal-case tracking-normal">{m.level}</Badge> : <span className="text-zinc-400">—</span>}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex max-w-48 flex-wrap items-center gap-1">
                        {m.skills.length ? <>
                          {m.skills.slice(0, 2).map((tag) => <span key={tag} title={tag} className="max-w-32 truncate rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">{tag}</span>)}
                          {m.skills.length > 2 && <span title={m.skills.slice(2).join(', ')} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">+{m.skills.length - 2}</span>}
                        </> : <span className="text-zinc-400">—</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-600"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-zinc-400" />{m.minutes} mins</span></td>
                    <td className="px-3 py-1.5">
                      {journeys || trainingsUsed ? journeyOnlyUsage ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700" title={`${journeys} journey${journeys === 1 ? '' : 's'}`}>
                          <Route className="size-3.5 shrink-0" /> {journeys}
                        </span>
                      ) : (
                        <span className="block truncate text-xs font-medium text-brand-700" title={`${journeys} journeys · ${trainingsUsed} trainings`}>{journeys ? `${journeys} journey${journeys === 1 ? '' : 's'}` : ''}{journeys && trainingsUsed ? ' · ' : ''}{trainingsUsed ? `${trainingsUsed} training${trainingsUsed === 1 ? '' : 's'}` : ''}</span>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {assignedLabel ? (
                        <span role="img" aria-label={assignedLabel} className="inline-flex max-w-40 items-center gap-2 rounded-full bg-mpesa-500/10 px-2.5 py-1 text-xs font-semibold text-mpesa-700" title={assignedLabel}>
                          {groups > 0 && <span className="inline-flex items-center gap-1"><Users className="size-3.5 shrink-0" />{groups}</span>}
                          {individuals > 0 && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5 shrink-0" />{individuals}</span>}
                        </span>
                      ) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-600">{updatedLabel(m.updatedAt)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1.5">
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
              {!visibleRows.length && <tr><td colSpan={9} className="px-4 py-2"><Empty icon={FileText} compact title={data.materials.length ? 'No materials match these filters' : 'No materials yet'} text={data.materials.length ? 'Try another type, level, skill or search.' : 'Add documents, videos and presentations to use in journeys.'} /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span>{rows.length ? `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, rows.length)} of ${rows.length} materials` : 'No materials to show'}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 whitespace-nowrap">Rows per page
              <Select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0) }} aria-label="Rows per page" className="h-9 w-[4.5rem] py-0 text-xs">
                {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </Select>
            </label>
            <span className="whitespace-nowrap">Page {currentPage + 1} of {pageCount}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="h-9 w-9 p-0"><ChevronLeft className="size-4" /></Button>
              {pageNumbers.map((number) => <button key={number} type="button" aria-current={number === currentPage ? 'page' : undefined} onClick={() => setPage(number)} className={cn('grid size-9 place-items-center rounded-xl border text-xs font-semibold transition', number === currentPage ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50')}>{number + 1}</button>)}
              <Button size="sm" aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} className="h-9 w-9 p-0"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </div>
      </section>
      {editing && <MaterialModal material={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {replacing && <ReplaceFileModal material={replacing} onClose={() => setReplacing(null)} />}
      {assigning && <AssignMaterialModal material={assigning} onClose={() => setAssigning(null)} />}
      <MaterialPreview material={preview} onClose={() => setPreview(null)} />
    </>
  )
}
