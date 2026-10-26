import { Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { uid, useAdmin } from '../store'
import type { Category } from '../types'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea } from '../ui'

function CategoryModal({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { data, update } = useAdmin()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [subcategories, setSubcategories] = useState<string[]>([])
  const taken = data.categories.some((c) => c.id !== category?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase())
  const isDuplicateSubcategory = (value: string, index: number) => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return false
    return (category?.subcategories ?? []).some((sub) => sub.name.trim().toLowerCase() === normalized) ||
      subcategories.slice(0, index).some((sub) => sub.trim().toLowerCase() === normalized)
  }
  const hasDuplicateSubcategories = subcategories.some(isDuplicateSubcategory)
  const appendSubcategory = () => {
    const nextIndex = subcategories.length
    setSubcategories((current) => [...current, ''])
    window.requestAnimationFrame(() => document.getElementById(`category-subcategory-${nextIndex}`)?.focus())
  }

  const save = () => {
    const addedSubcategories = subcategories
      .map((sub) => sub.trim())
      .filter(Boolean)
      .map((sub) => ({ id: uid('cs'), name: sub, description: '' }))
    const next: Category = {
      id: category?.id ?? uid('c'),
      name: name.trim(),
      description: description.trim(),
      subcategories: [...(category?.subcategories ?? []), ...addedSubcategories],
    }
    update((d) => ({ ...d, categories: category ? d.categories.map((c) => (c.id === next.id ? next : c)) : [...d.categories, next] }), {
      action: category ? 'Updated category' : 'Created category',
      target: next.name,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || taken || hasDuplicateSubcategories} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {taken && <span className="mt-1 block text-xs text-brand-600">A category with this title already exists.</span>}
        </Field>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {subcategories.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-700">Sub-categories (optional)</p>
              <Button size="sm" variant="ghost" type="button" onClick={appendSubcategory}>
                <Plus className="size-3.5" /> Add another
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {subcategories.map((sub, index) => {
                const duplicate = isDuplicateSubcategory(sub, index)
                return (
                  <div key={index} className={sub.trim().length > 12 ? 'sm:col-span-3' : ''}>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`category-subcategory-${index}`}
                        value={sub}
                        onChange={(e) => setSubcategories((current) => current.map((value, i) => i === index ? e.target.value : value))}
                        placeholder="Sub-category title"
                        aria-label={`Sub-category ${index + 1}`}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          if (sub.trim() && !duplicate) appendSubcategory()
                        }}
                      />
                      <Button size="sm" variant="ghost" type="button" onClick={() => setSubcategories((current) => current.filter((_, i) => i !== index))} aria-label={`Remove sub-category ${index + 1}`}>
                        <X className="size-4" />
                      </Button>
                    </div>
                    {duplicate && <p className="mt-1 text-xs text-brand-600">This sub-category already exists.</p>}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" type="button" onClick={() => setSubcategories([''])}>
            <Plus className="size-3.5" /> Add sub-category
          </Button>
        )}
      </div>
    </Modal>
  )
}

/** Custom categories and sub-categories used by trainings, requests and content (TA-3.7, URS 2.4). */
export function AdminCategories() {
  const { data, update } = useAdmin()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [renaming, setRenaming] = useState<{ cat: string; sub: string; value: string } | null>(null)

  const usage = (c: Category) => data.trainings.filter((t) => t.categoryId === c.id).length + data.requests.filter((r) => r.categories.includes(c.name)).length
  const subUsage = (subId: string) => data.trainings.filter((t) => t.subcategoryId === subId).length

  const setSubs = (c: Category, subcategories: Category['subcategories'], action: string, target: string) =>
    update((d) => ({ ...d, categories: d.categories.map((x) => (x.id === c.id ? { ...x, subcategories } : x)) }), { action, target })

  const addSub = (c: Category) => {
    const name = (drafts[c.id] ?? '').trim()
    if (!name || c.subcategories.some((s) => s.name.toLowerCase() === name.toLowerCase())) return
    setSubs(c, [...c.subcategories, { id: uid('cs'), name, description: '' }], 'Added sub-category', `${c.name} › ${name}`)
    setDrafts((d) => ({ ...d, [c.id]: '' }))
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Classify trainings, requests and materials. Sub-categories are optional."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />
      {data.categories.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.categories.map((c) => {
            const used = usage(c)
            return (
              <Card key={c.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-900">{c.name}</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">{c.description || 'No description.'}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Used by {used} training{used === 1 ? '' : 's'} or request{used === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={used > 0}
                      title={used ? 'In use — can’t be deleted' : 'Delete'}
                      onClick={() => update((d) => ({ ...d, categories: d.categories.filter((x) => x.id !== c.id) }), { action: 'Deleted category', target: c.name })}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500">Sub-categories</p>
                  <ul className="flex flex-wrap gap-2">
                    {c.subcategories.map((s) =>
                      renaming?.sub === s.id ? (
                        <li key={s.id}>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (renaming.value.trim()) setSubs(c, c.subcategories.map((x) => (x.id === s.id ? { ...x, name: renaming.value.trim() } : x)), 'Renamed sub-category', `${c.name} › ${renaming.value.trim()}`)
                              setRenaming(null)
                            }}
                          >
                            <Input value={renaming.value} onChange={(e) => setRenaming({ ...renaming, value: e.target.value })} onBlur={() => setRenaming(null)} autoFocus className="py-1 text-xs" aria-label="Sub-category name" />
                          </form>
                        </li>
                      ) : (
                        <li key={s.id} className="group inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1 pl-3 text-xs text-zinc-700">
                          <button type="button" onClick={() => setRenaming({ cat: c.id, sub: s.id, value: s.name })} className="hover:underline" title="Rename">
                            {s.name}
                          </button>
                          {subUsage(s.id) > 0 && <span className="text-zinc-400">· {subUsage(s.id)}</span>}
                          <button
                            type="button"
                            disabled={subUsage(s.id) > 0}
                            onClick={() => setSubs(c, c.subcategories.filter((x) => x.id !== s.id), 'Removed sub-category', `${c.name} › ${s.name}`)}
                            className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove ${s.name}`}
                            title={subUsage(s.id) ? 'In use by trainings' : 'Remove'}
                          >
                            <X className="size-3" />
                          </button>
                        </li>
                      ),
                    )}
                    {!c.subcategories.length && <li className="text-xs text-zinc-400">None yet</li>}
                  </ul>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      addSub(c)
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <Input value={drafts[c.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} placeholder="Add a sub-category" className="py-1.5 text-sm" aria-label={`New sub-category for ${c.name}`} />
                    <Button size="sm" type="submit" disabled={!(drafts[c.id] ?? '').trim()}>
                      <Plus className="size-3.5" /> Add
                    </Button>
                  </form>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <Empty icon={Tags} title="No categories" action={<Button onClick={() => setEditing('new')}>Create one</Button>} />
        </Card>
      )}
      {editing && <CategoryModal category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
