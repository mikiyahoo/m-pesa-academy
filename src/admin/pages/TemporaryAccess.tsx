import { Ban, CalendarPlus, Copy, Download, Mail, MoreHorizontal, Pencil, RotateCcw, Upload, UserPlus, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO, todayISO } from '../../lib/utils'
import { dateTime, shortDate } from '../helpers'
import { EMAIL_RE, isInternalEmail, mergeParticipants, parseParticipants } from '../requests'
import { uid, useAdmin } from '../store'
import { acceptLink, accessLabel, accessState, addDays, DEFAULT_GRACE_DAYS, daysLeft, isTemporary, makeInviteToken, trainingsFor, type AccessState } from '../temporary'
import type { Person, RequestParticipant } from '../types'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, Tabs } from '../ui'

const stateTone: Record<AccessState, 'zinc' | 'green' | 'red' | 'amber' | 'blue'> = {
  pending: 'blue',
  scheduled: 'zinc',
  active: 'green',
  expiring: 'amber',
  expired: 'red',
  revoked: 'red',
}

/**
 * Invite temporary (external) users by email, manually or in bulk, with an access window
 * (TA-1.3, TA-1.4, TR-1.3, URS 2.1). Can add them straight to a training and/or a new group.
 */
export function InviteTemporaryModal({ onClose, trainingId }: { onClose: () => void; trainingId?: string }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const training = data.trainings.find((t) => t.id === trainingId)
  const today = todayISO()
  const [list, setList] = useState<RequestParticipant[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [phone, setPhone] = useState('')
  const [paste, setPaste] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(addDays(training && training.date > today ? training.date : today, DEFAULT_GRACE_DAYS))
  const [addTo, setAddTo] = useState(trainingId ?? '')
  const [groupName, setGroupName] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const existing = (e: string) => data.people.find((p) => p.email.toLowerCase() === e.toLowerCase())
  const rows = list.map((r) => ({ ...r, known: existing(r.email), internal: isInternalEmail(r.email) }))
  const toInvite = rows.filter((r) => !r.known && !r.internal)
  const upcoming = data.trainings.filter((t) => t.date >= today && t.status !== 'CANCELLED').sort((a, b) => a.date.localeCompare(b.date))

  const problems = [
    !toInvite.length && 'Add at least one new external email.',
    start < today && 'Access can’t start in the past.',
    end < start && 'Access must end after it starts.',
    toInvite.some((r) => !r.name.trim()) && 'Every temporary user needs a name.',
  ].filter(Boolean) as string[]

  const addOne = () => {
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) return setErrors([`“${email}” isn’t a valid email`])
    setList(mergeParticipants(list, [{ email: e, name: name.trim() }]))
    setEmail('')
    setName('')
    setErrors([])
  }
  const importText = (text: string) => {
    const { rows: parsed, errors: errs } = parseParticipants(text)
    setList(mergeParticipants(list, parsed))
    setErrors(errs)
  }

  const invite = () => {
    const at = localISO()
    const groupId = groupName.trim() ? uid('g') : undefined
    const created: Person[] = toInvite.map((r) => ({
      id: uid('u'),
      name: r.name.trim(),
      email: r.email,
      phone: toInvite.length === 1 ? phone.trim() : '',
      role: 'Participant',
      status: 'Active',
      department: '',
      organization: org.trim() || undefined,
      groupIds: groupId ? [groupId] : [],
      createdAt: at.slice(0, 10),
      accessStart: start,
      accessEnd: end,
      inviteToken: makeInviteToken(),
      invitedAt: at,
      invitedBy: 'Training team',
      accessHistory: [{ at, by: 'Training team', change: `Invited · access ${shortDate(start)} – ${shortDate(end)}` }],
    }))
    const ids = created.map((p) => p.id)
    update(
      (d) => ({
        ...d,
        people: [...created, ...d.people],
        groups: groupId ? [...d.groups, { id: groupId, name: groupName.trim(), description: `Temporary trainees invited ${shortDate(today)}` }] : d.groups,
        trainings: addTo ? d.trainings.map((t) => (t.id === addTo ? { ...t, participantIds: [...new Set([...t.participantIds, ...ids])] } : t)) : d.trainings,
      }),
      { action: `Invited ${created.length} temporary user${created.length === 1 ? '' : 's'}`, target: groupName.trim() || created[0]?.name || '', silent: true },
    )
    toast(sendEmail ? `Invited ${created.length} · invite emails with sign-in links queued` : `Created ${created.length} invite${created.length === 1 ? '' : 's'} — copy the links from Temporary access`)
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Invite temporary users"
      description="External trainees get an email with a personal sign-in link. They verify with a code — no password."
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{problems[0] ?? `${toInvite.length} to invite`}</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={problems.length > 0} onClick={invite}>
            <UserPlus className="size-4" /> Invite {toInvite.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900">People</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.2fr_auto]">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Name" />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOne())} placeholder="name@company.com" aria-label="Email" />
            <Button onClick={addOne} disabled={!email.trim()}>
              <UserPlus className="size-4" /> Add
            </Button>
          </div>
          <details className="rounded-xl border border-zinc-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-800">Bulk: paste a list or upload a CSV (name, email)</summary>
            <div className="mt-3 space-y-2">
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={4}
                aria-label="Paste list"
                placeholder={'name,email\nLiya Bekele,liya.bekele@gmail.com'}
                className="w-full rounded-lg border border-zinc-200 bg-surface px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={!paste.trim()} onClick={() => (importText(paste), setPaste(''))}>
                  Add pasted list
                </Button>
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Upload CSV
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      const r = new FileReader()
                      r.onload = () => importText(String(r.result ?? ''))
                      r.readAsText(f)
                    }
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </details>
          {errors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-amber-800">
              {errors.slice(0, 4).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Invitee list ({rows.length})</span>
                <span className="text-[11px] text-zinc-400">Scroll to view all</span>
              </div>
              <ul className="max-h-80 sm:max-h-96 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
                {rows.map((r, i) => (
                <li key={r.email} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    value={r.name}
                    onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="Name required"
                    aria-label={`Name for ${r.email}`}
                    disabled={!!r.known || r.internal}
                    className={cn('w-40 min-w-0 rounded border bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand-500', !r.name.trim() && !r.known && !r.internal ? 'border-amber-500' : 'border-transparent')}
                  />
                  <span className="min-w-0 flex-1 truncate text-zinc-600">{r.email}</span>
                  {r.known ? (
                    <span className="text-xs text-zinc-500">Already has access — skipped</span>
                  ) : r.internal ? (
                    <span className="text-xs text-zinc-500">Internal — signs in with AD</span>
                  ) : (
                    <Badge tone="blue">NEW</Badge>
                  )}
                  <button onClick={() => setList(list.filter((_, j) => j !== i))} className="text-xs text-zinc-400 hover:text-brand-600" aria-label={`Remove ${r.email}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Organisation (optional)">
              <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. ISON Africa" />
            </Field>
            {toInvite.length <= 1 && (
              <Field label="Mobile number for the sign-in code (optional)">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" />
              </Field>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <h3 className="text-sm font-semibold text-zinc-900 sm:col-span-2">Access window</h3>
          <Field label="Access starts">
            <Input type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Access ends" hint="Includes time to view records after the training. Can be extended later.">
            <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <h3 className="text-sm font-semibold text-zinc-900 sm:col-span-2">Add them to</h3>
          <Field label="Training (optional)">
            <Select
              value={addTo}
              onChange={(e) => {
                setAddTo(e.target.value)
                const t = data.trainings.find((x) => x.id === e.target.value)
                if (t) setEnd(addDays(t.date > start ? t.date : start, DEFAULT_GRACE_DAYS))
              }}
            >
              <option value="">No training yet</option>
              {upcoming.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {shortDate(t.date)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="New group (optional)" hint="Creates a group for these trainees (TR-1.3).">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Hawassa agents — Nov" />
          </Field>
        </section>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="size-4 accent-brand-600" />
          <Mail className="size-4 text-zinc-500" /> Email each person their sign-in link
        </label>
      </div>
    </Modal>
  )
}

function ExtendModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const { update } = useAdmin()
  const today = todayISO()
  const base = person.accessEnd && person.accessEnd > today ? person.accessEnd : today
  const [end, setEnd] = useState(addDays(base, 30))
  const save = () => {
    const at = localISO()
    update(
      (d) => ({
        ...d,
        people: d.people.map((p) =>
          p.id === person.id ? { ...p, accessEnd: end, accessHistory: [...(p.accessHistory ?? []), { at, by: 'Training team', change: `Extended ${p.accessEnd ? shortDate(p.accessEnd) : '—'} → ${shortDate(end)}` }] } : p,
        ),
      }),
      { action: `Extended access to ${shortDate(end)}`, target: person.name },
    )
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Extend access"
      description={`${person.name}'s access currently ends ${person.accessEnd ? shortDate(person.accessEnd) : '—'}. You can extend it even after it has ended.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={end <= (person.accessEnd ?? '') || end < today} onClick={save}>
            <CalendarPlus className="size-4" /> Extend
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="New end date">
          <Input type="date" min={today} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setEnd(addDays(base, n))} className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100">
              +{n} days
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

/**
 * Fix an invited trainee's details. Changing the email of an invite that hasn't been accepted
 * issues a new sign-in link (the old one may have gone to the wrong inbox) and can resend it.
 */
function EditInvitedUserModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [name, setName] = useState(person.name)
  const [email, setEmail] = useState(person.email)
  const [org, setOrg] = useState(person.organization ?? '')
  const [phone, setPhone] = useState(person.phone ?? '')
  const [resend, setResend] = useState(true)

  const accepted = !!person.acceptedAt
  const nextEmail = email.trim().toLowerCase()
  const emailChanged = person.email.toLowerCase() !== nextEmail
  const emailError = !EMAIL_RE.test(nextEmail)
    ? 'Enter a valid email address.'
    : isInternalEmail(nextEmail)
      ? 'This is a company address — add the person as a staff user under Users instead.'
      : data.people.some((x) => x.id !== person.id && x.email.toLowerCase() === nextEmail)
        ? 'Someone already uses this email.'
        : ''
  const valid = !!name.trim() && !emailError

  const save = () => {
    const at = localISO()
    const changes = [
      emailChanged && { field: 'Email', from: person.email, to: nextEmail },
      person.name !== name.trim() && { field: 'Name', from: person.name, to: name.trim() },
      (person.organization ?? '') !== org.trim() && { field: 'Organisation', from: person.organization ?? '—', to: org.trim() || '—' },
      (person.phone ?? '') !== phone.trim() && { field: 'Phone', from: person.phone || '—', to: phone.trim() || '—' },
    ].filter((c): c is { field: string; from: string; to: string } => !!c)
    if (!changes.length) return onClose()
    const newLink = emailChanged && !accepted
    update(
      (d) => ({
        ...d,
        people: d.people.map((x) =>
          x.id === person.id
            ? {
                ...x,
                name: name.trim(),
                email: nextEmail,
                phone: phone.trim(),
                organization: org.trim() || undefined,
                ...(newLink ? { inviteToken: makeInviteToken(), invitedAt: at } : {}),
                accessHistory: [
                  ...(x.accessHistory ?? []),
                  { at, by: 'Training team', change: `Updated ${changes.map((c) => c.field.toLowerCase()).join(', ')}${newLink ? ' — new sign-in link issued' : ''}` },
                ],
              }
            : x,
        ),
      }),
      { action: newLink && resend ? 'Updated invite and resent' : 'Updated invited trainee details', target: name.trim(), changes },
    )
    toast(newLink ? (resend ? `New invite sent to ${nextEmail} — the old link no longer works` : 'Email updated — the old link no longer works') : 'Trainee details updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit invite — ${person.name}`}
      description="Correct the name, email, phone or organisation."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email address" hint={accepted ? 'They have already signed in, so their sign-in link stays the same.' : 'Changing it issues a new sign-in link and cancels the old one.'}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus aria-invalid={!!emailError} />
        </Field>
        {emailError && email.trim() && <p className="-mt-2 text-xs font-medium text-brand-700">{emailError}</p>}
        {emailChanged && !accepted && !emailError && (
          <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 p-3 text-sm">
            <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-medium text-zinc-900">Send the new invite now</span>
              <span className="block text-xs text-zinc-500">An invite email with the new link goes to {nextEmail}.</span>
            </span>
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Organisation">
            <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. ISON Africa" />
          </Field>
          <Field label="Phone number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

type Filter = 'all' | 'active' | 'pending' | 'expiring' | 'ended'

export function AdminTemporaryAccess() {
  const { data, update } = useAdmin()
  const { toast, confirm } = useFeedback()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [inviting, setInviting] = useState(false)
  const [extending, setExtending] = useState<Person | null>(null)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Person | null>(null)

  const temps = useMemo(() => data.people.filter(isTemporary).map((p) => ({ p, state: accessState(p) })), [data.people])
  const match = (s: AccessState, f: Filter) =>
    f === 'all' || (f === 'active' && (s === 'active' || s === 'expiring')) || (f === 'pending' && (s === 'pending' || s === 'scheduled')) || (f === 'expiring' && s === 'expiring') || (f === 'ended' && (s === 'expired' || s === 'revoked'))
  const rows = temps.filter(({ p, state }) => match(state, filter) && (!q || `${p.name} ${p.email} ${p.organization ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const count = (f: Filter) => temps.filter(({ state }) => match(state, f)).length

  const copy = async (p: Person) => {
    if (!p.inviteToken) return
    try {
      await navigator.clipboard.writeText(acceptLink(p.inviteToken))
      toast('Sign-in link copied')
    } catch {
      toast('Copy failed', { tone: 'error' })
    }
    setMenu(null)
  }

  const setRevoked = async (p: Person, revoke: boolean) => {
    setMenu(null)
    if (revoke && !(await confirm({ title: `Revoke ${p.name}'s access?`, message: 'They are signed out and can no longer use their link. Their training records are kept.', confirmLabel: 'Revoke access', danger: true }))) return
    const at = localISO()
    update(
      (d) => ({
        ...d,
        people: d.people.map((x) =>
          x.id === p.id ? { ...x, revokedAt: revoke ? at : undefined, status: revoke ? 'Inactive' : 'Active', accessHistory: [...(x.accessHistory ?? []), { at, by: 'Training team', change: revoke ? 'Access revoked' : 'Access restored' }] } : x,
        ),
      }),
      { action: revoke ? 'Revoked access' : 'Restored access', target: p.name },
    )
  }

  return (
    <>
      <PageHeader
        title="Temporary access"
        description="External trainees invited by email. Each has an access window; they sign in with their personal link and a code."
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv(
                  'temporary-users.csv',
                  ['Name', 'Email', 'Organisation', 'Access starts', 'Access ends', 'Status', 'Last sign-in'],
                  rows.map(({ p, state }) => [p.name, p.email, p.organization ?? '', p.accessStart ?? '', p.accessEnd ?? '', accessLabel[state], p.lastSignInAt ?? '']),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
            <Button variant="primary" onClick={() => setInviting(true)}>
              <UserPlus className="size-4" /> Invite
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['pending', 'Not signed in yet'],
              ['expiring', 'Expiring soon'],
              ['ended', 'Expired / revoked'],
            ] as [Filter, string][]
          ).map(([value, label]) => ({ value, label, count: count(value) }))}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email, organisation…" className="w-full sm:w-72" />
      </div>

      {rows.length ? (
        <Table head={['Name', 'Organisation', 'Access', 'Status', 'Trainings', 'Last sign-in', '']} minWidth={860}>
          {rows.map(({ p, state }) => {
            const left = daysLeft(p)
            return (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <button onClick={() => setViewing(p)} className="flex items-center gap-3 text-left">
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-900 hover:text-brand-600">{p.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 text-zinc-600">{p.organization ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                  {p.accessStart ? shortDate(p.accessStart) : '—'} – {p.accessEnd ? shortDate(p.accessEnd) : '—'}
                  {left !== null && state !== 'revoked' && (
                    <span className={cn('block text-xs', left < 0 ? 'text-brand-600' : left <= 7 ? 'text-amber-700' : 'text-zinc-400')}>
                      {left < 0 ? `ended ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'ends today' : `${left} day${left === 1 ? '' : 's'} left`}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stateTone[state]}>{accessLabel[state].toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-600">{trainingsFor(p.id, data.trainings).length}</td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{p.lastSignInAt ? dateTime(p.lastSignInAt) : p.acceptedAt ? dateTime(p.acceptedAt) : 'Never'}</td>
                <td className="relative px-4 py-3 text-right">
                  <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Actions for ${p.name}`}>
                    <MoreHorizontal className="size-4" />
                  </button>
                  {menu === p.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                      <div className="absolute right-4 z-20 mt-1 w-52 rounded-xl border border-zinc-200 bg-surface p-1 text-left text-sm shadow-lg">
                        <button onClick={() => (setEditingPerson(p), setMenu(null))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                          <Pencil className="size-4" /> Edit invite
                        </button>
                        <button onClick={() => (setExtending(p), setMenu(null))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                          <CalendarPlus className="size-4" /> Extend access
                        </button>
                        <button onClick={() => copy(p)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                          <Copy className="size-4" /> Copy sign-in link
                        </button>
                        <button
                          onClick={() => {
                            setMenu(null)
                            update((d) => d, { action: 'Resent invite email', target: p.name, silent: true })
                            toast(`Invite email resent to ${p.email}`)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100"
                        >
                          <Mail className="size-4" /> Resend invite
                        </button>
                        {state === 'revoked' ? (
                          <button onClick={() => setRevoked(p, false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100">
                            <RotateCcw className="size-4" /> Restore access
                          </button>
                        ) : (
                          <button onClick={() => setRevoked(p, true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
                            <Ban className="size-4" /> Revoke access
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      ) : (
        <Card>
          <Empty icon={Users} title="No temporary users here" text="Invite external trainees to give them time-limited access." action={<Button onClick={() => setInviting(true)}>Invite</Button>} />
        </Card>
      )}

      {inviting && <InviteTemporaryModal onClose={() => setInviting(false)} />}
      {extending && <ExtendModal person={extending} onClose={() => setExtending(null)} />}
      {editingPerson && <EditInvitedUserModal person={editingPerson} onClose={() => setEditingPerson(null)} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.name} description={viewing.email}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Organisation', viewing.organization],
              ['Designation', viewing.designation],
              ['Region', viewing.region],
              ['Invited', viewing.invitedAt ? `${dateTime(viewing.invitedAt)}${viewing.invitedBy ? ` by ${viewing.invitedBy}` : ''}` : undefined],
              ['First sign-in', viewing.acceptedAt ? dateTime(viewing.acceptedAt) : 'Not yet'],
              ['Status', accessLabel[accessState(viewing)]],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-zinc-500">{k}</dt>
                <dd className="font-medium text-zinc-900">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          <h4 className="mt-5 text-xs text-zinc-500">Trainings</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {trainingsFor(viewing.id, data.trainings).map((t) => (
              <li key={t.id}>
                <Link to={`/admin/trainings/${t.id}`} className="text-brand-600 hover:underline">
                  {t.name}
                </Link>{' '}
                <span className="text-zinc-500">· {shortDate(t.date)}</span>
              </li>
            ))}
            {!trainingsFor(viewing.id, data.trainings).length && <li className="text-zinc-500">None</li>}
          </ul>
          <h4 className="mt-5 text-xs text-zinc-500">Access history</h4>
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {(viewing.accessHistory ?? []).map((h, i) => (
              <li key={i}>
                {h.change} <span className="text-xs text-zinc-400">· {dateTime(h.at)} · {h.by}</span>
              </li>
            ))}
            {!(viewing.accessHistory ?? []).length && <li className="text-zinc-500">No changes recorded.</li>}
          </ul>
        </Modal>
      )}
    </>
  )
}
