import { ArrowDown, ArrowUp, BookOpen, FileText, Layers, PlayCircle, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MaterialPreview, materialIcon } from '../MaterialPreview'
import { uid, useAdmin } from '../store'
import type { Journey, Material, MaterialType } from '../types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, Tabs, Textarea } from '../ui'

/* ---------------------------------- Journeys --------------------------------- */

function NewJourneyModal({ onClose }: { onClose: () => void }) {
  const { update } = useAdmin()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const save = () => {
    const j: Journey = { id: uid('j'), name: name.trim(), description: description.trim(), modules: [] }
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
          const used = data.trainings.filter((t) => t.journeyId === j.id).length
          return (
            <Link key={j.id} to={`/admin/journeys/${j.id}`} className="group rounded-xl border border-zinc-200 bg-surface p-5 transition hover:border-zinc-300 hover:shadow-md">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <BookOpen className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-zinc-900 group-hover:text-brand-600">{j.name}</h3>
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

  const move = (i: number, dir: -1 | 1) => {
    const next = [...journey.modules]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    save(next, 'Reordered modules')
  }

  return (
    <>
      <PageHeader title={<>{journey.name} <Badge>JOURNEY</Badge></>} description={journey.description} />
      <div className="space-y-3">
        {journey.modules.map((m, i) => {
          const available = data.materials.filter((x) => !m.materialIds.includes(x.id))
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">{i + 1}</span>
                <h3 className="flex-1 font-medium text-zinc-900">{m.title}</h3>
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
                    <div key={mid} className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2">
                      <Icon className="size-4 text-zinc-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-900">{mat.title}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">
                          {mat.type} · {mat.minutes} mins
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

function MaterialModal({ material, onClose }: { material?: Material; onClose: () => void }) {
  const { update } = useAdmin()
  const [form, setForm] = useState({
    title: material?.title ?? '',
    type: material?.type ?? ('DOCUMENT' as MaterialType),
    minutes: String(material?.minutes ?? 10),
    description: material?.description ?? '',
  })
  const valid = form.title.trim() && Number(form.minutes) > 0

  const save = () => {
    const updatedAt = new Date().toISOString().slice(0, 10)
    const next: Material = { id: material?.id ?? uid('mat'), title: form.title.trim(), type: form.type, minutes: Number(form.minutes), description: form.description.trim(), updatedAt }
    update(
      (d) => ({ ...d, materials: material ? d.materials.map((m) => (m.id === material.id ? next : m)) : [next, ...d.materials] }),
      { action: material ? 'Updated material' : 'Uploaded material', target: next.title },
    )
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={material ? 'Edit material' : 'Add material'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </Field>
        </div>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaterialType })}>
            {(['DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as MaterialType[]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" min={1} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        {!material && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 sm:col-span-2">
            File upload is simulated in this demo — only the details above are saved.
          </div>
        )}
      </div>
    </Modal>
  )
}

export function AdminMaterials() {
  const { data, update } = useAdmin()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeFilter>('ALL')
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [preview, setPreview] = useState<Material | null>(null)

  const rows = data.materials.filter((m) => (type === 'ALL' || m.type === type) && (!q || m.title.toLowerCase().includes(q.toLowerCase())))
  const usage = (id: string) => data.journeys.filter((j) => j.modules.some((m) => m.materialIds.includes(id))).length

  const remove = (m: Material) => {
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
        description="Documents, videos and presentations used in journeys."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add material
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<TypeFilter>
          value={type}
          onChange={setType}
          items={(['ALL', 'DOCUMENT', 'VIDEO', 'PRESENTATION', 'LINK'] as TypeFilter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase() }))}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search materials…" className="w-full sm:w-64" />
      </div>
      <Table head={['Title', 'Type', 'Duration', 'Used in', 'Updated', '']}>
        {rows.map((m) => {
          const Icon = materialIcon[m.type]
          return (
            <tr key={m.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900">{m.title}</span>
                    <span className="line-clamp-1 text-xs text-zinc-500">{m.description}</span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge>{m.type}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">{m.minutes} mins</td>
              <td className="px-4 py-3 text-zinc-600">{usage(m.id)} journeys</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{m.updatedAt}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(m)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label="Delete">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        })}
      </Table>
      {editing && <MaterialModal material={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <MaterialPreview material={preview} onClose={() => setPreview(null)} />
    </>
  )
}
