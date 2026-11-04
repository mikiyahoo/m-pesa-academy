import { Building2, MapPin, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useFeedback } from '../../components/Feedback'
import { RowMenu } from '../../components/RowMenu'
import { uid, useAdmin } from '../store'
import type { Venue } from '../types'
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, TabBar, Table } from '../ui'
import { searchVenues, venueLabel, venuesOf, venueTypesOf } from '../venues'

function VenueModal({ venue, onClose }: { venue?: Venue; onClose: () => void }) {
  const { data, update } = useAdmin()
  const types = venueTypesOf(data)
  const sites = [...new Set(venuesOf(data).map((v) => v.site))].sort()
  const [form, setForm] = useState({ name: venue?.name ?? '', site: venue?.site ?? '', type: venue?.type ?? types[0] ?? '', floor: venue?.floor ?? '', capacity: venue?.capacity ? String(venue.capacity) : '' })
  const duplicate = venuesOf(data).some((v) => v.id !== venue?.id && v.name.toLowerCase() === form.name.trim().toLowerCase() && v.site.toLowerCase() === form.site.trim().toLowerCase())
  const valid = form.name.trim() && form.site.trim() && form.type && !duplicate

  const save = () => {
    const next: Venue = { id: venue?.id ?? uid('v'), name: form.name.trim(), site: form.site.trim(), type: form.type, floor: form.floor.trim() || undefined, capacity: Number(form.capacity) || undefined }
    update((d) => {
      const list = venuesOf(d)
      return { ...d, venues: venue ? list.map((v) => (v.id === venue.id ? next : v)) : [...list, next] }
    }, { action: venue ? 'Updated venue' : 'Added venue', target: venueLabel(next) })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={venue ? 'Edit venue' : 'Add venue'}
      description="Venues are suggested when someone types a location while scheduling a physical session."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {venue ? 'Save' : 'Add venue'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Room or space">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Training Room 4B" autoFocus />
        </Field>
        <Field label="Site / building">
          <Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="e.g. Safaricom Ethiopia HQ" list="venue-sites" />
          <datalist id="venue-sites">
            {sites.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Floor (optional)">
          <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="e.g. 4th floor" />
        </Field>
        <Field label="Capacity (optional)">
          <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Seats" />
        </Field>
        {duplicate && <p className="text-xs text-brand-600 sm:col-span-2">This room already exists at that site.</p>}
      </div>
    </Modal>
  )
}

/** Venue types (Hall, Meeting room…) the venue form offers. */
function VenueTypesCard() {
  const { data, update } = useAdmin()
  const types = venueTypesOf(data)
  const [draft, setDraft] = useState('')
  const used = (t: string) => venuesOf(data).filter((v) => v.type === t).length
  const add = () => {
    const name = draft.trim()
    if (!name || types.some((t) => t.toLowerCase() === name.toLowerCase())) return
    update((d) => ({ ...d, venueTypes: [...venueTypesOf(d), name] }), { action: 'Added venue type', target: name })
    setDraft('')
  }
  return (
    <Card>
      <CardTitle>Venue types</CardTitle>
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 py-1 pr-1 pl-3 text-sm text-zinc-800">
            {t}
            <span className="text-xs text-zinc-400">{used(t)}</span>
            <button
              type="button"
              disabled={used(t) > 0}
              title={used(t) ? 'In use by a venue' : `Remove ${t}`}
              aria-label={`Remove ${t}`}
              onClick={() => update((d) => ({ ...d, venueTypes: venueTypesOf(d).filter((x) => x !== t) }), { action: 'Removed venue type', target: t })}
              className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a type, e.g. Studio" className="max-w-xs" />
        <Button onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" /> Add type
        </Button>
      </div>
    </Card>
  )
}

export function AdminVenues() {
  const { data, update } = useAdmin()
  const { confirm } = useFeedback()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Venue | 'new' | null>(null)
  const all = venuesOf(data)
  const rows = q.trim() ? searchVenues(all, q, all.length) : [...all].sort((a, b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name))
  const usedIn = (v: Venue) => data.trainings.filter((t) => t.location === venueLabel(v)).length

  const remove = async (v: Venue) => {
    if (!(await confirm({ title: `Remove ${v.name}?`, message: 'It stops being suggested. Trainings already scheduled there keep their location.', confirmLabel: 'Remove' }))) return
    update((d) => ({ ...d, venues: venuesOf(d).filter((x) => x.id !== v.id) }), { action: 'Removed venue', target: venueLabel(v) })
  }

  return (
    <>
      <PageHeader
        title="Venues"
        description="Halls, meeting rooms and training rooms suggested when scheduling physical sessions."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add venue
          </Button>
        }
      />
      <div className="space-y-5">
        <TabBar className="mb-0">
          <SearchInput value={q} onChange={setQ} placeholder="Search venues, sites or types…" className="w-full sm:w-80" />
          <span className="pr-2 text-xs text-zinc-500">
            {all.length} venue{all.length === 1 ? '' : 's'} · {new Set(all.map((v) => v.site)).size} sites
          </span>
        </TabBar>
        {rows.length ? (
          <Table head={['Venue', 'Site', 'Type', 'Capacity', 'Used in', '']} minWidth={680}>
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <MapPin className="size-4" />
                    </span>
                    <span>
                      <span className="block font-medium text-zinc-900">{v.name}</span>
                      {v.floor && <span className="block text-xs text-zinc-500">{v.floor}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-zinc-400" /> {v.site}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge>{v.type.toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-600 tabular-nums">{v.capacity ? `${v.capacity} seats` : '—'}</td>
                <td className="px-4 py-3 text-zinc-600 tabular-nums">{usedIn(v)}</td>
                <td className="px-4 py-3 text-right">
                  <RowMenu
                    label={`Actions for ${v.name}`}
                    items={[
                      { label: 'Edit', icon: Pencil, onClick: () => setEditing(v) },
                      { label: 'Remove', icon: Trash2, onClick: () => void remove(v), danger: true },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Card>
            <Empty icon={q ? Tag : MapPin} title={q ? `No venues match “${q}”` : 'No venues yet'} text={q ? 'Try another name, site or type.' : 'Add the halls and rooms you train in.'} />
          </Card>
        )}
        <VenueTypesCard />
      </div>
      {editing && <VenueModal venue={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
