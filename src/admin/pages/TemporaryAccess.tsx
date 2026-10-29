import { Ban, CalendarPlus, ChevronLeft, ChevronRight, Copy, Download, Eye, Globe2, GraduationCap, Mail, MoreHorizontal, Pencil, RotateCcw, Upload, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO, todayISO } from '../../lib/utils'
import { dateTime, shortDate } from '../helpers'
import { EMAIL_RE, isInternalEmail, mergeParticipants, parseParticipants } from '../requests'
import { uid, useAdmin } from '../store'
import { acceptLink, accessLabel, accessState, addDays, DEFAULT_GRACE_DAYS, daysLeft, isTemporary, makeInviteToken, trainingsFor, type AccessState } from '../temporary'
import type { Person, RequestParticipant } from '../types'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, TabBar, Tabs } from '../ui'
import { FullPageDialog } from '../Wizard'
import { useAuth } from '../../store/Auth'
import { isGuest, publicAccessSettings } from '../../lib/publicAccess'

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
  const { user } = useAuth()
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
      createdBy: user.name,
      accessStart: start,
      accessEnd: end,
      inviteToken: makeInviteToken(),
      invitedAt: at,
      invitedBy: user.name,
      accessHistory: [{ at, by: user.name, change: `Invited · access ${shortDate(start)} – ${shortDate(end)}` }],
    }))
    const ids = created.map((p) => p.id)
    update(
      (d) => ({
        ...d,
        people: [...created, ...d.people],
        groups: groupId ? [...d.groups, { id: groupId, name: groupName.trim(), description: `Temporary trainees invited ${shortDate(today)}`, organization: org.trim() || undefined }] : d.groups,
        trainings: addTo ? d.trainings.map((t) => (t.id === addTo ? { ...t, participantIds: [...new Set([...t.participantIds, ...ids])] } : t)) : d.trainings,
      }),
      { action: `Invited ${created.length} temporary user${created.length === 1 ? '' : 's'}`, target: groupName.trim() || created[0]?.name || '', silent: true },
    )
    toast(sendEmail ? `Invited ${created.length} · invite emails with sign-in links queued` : `Created ${created.length} invite${created.length === 1 ? '' : 's'} — copy the links from Temporary access`)
    onClose()
  }

  return (
    <FullPageDialog
      onClose={onClose}
      title="Invite temporary users"
      subtitle={`${toInvite.length} to invite`}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{problems[0] ?? 'Each person gets a personal sign-in link and verifies with a code.'}</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={problems.length > 0} onClick={invite}>
            <UserPlus className="size-4" /> Invite {toInvite.length || ''}
          </Button>
        </>
      }
    >
      <div className="divide-y divide-zinc-100 [&>section]:py-6 [&>section:first-child]:pt-0">
        <section className="space-y-4">
          <h3 className="flex items-center gap-3 text-base font-bold text-zinc-900">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Users className="size-4" />
            </span>
            People
          </h3>
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
                className="w-full rounded-xl border border-zinc-200 bg-surface px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-brand-500"
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
                    className={cn('w-40 min-w-0 rounded-lg border bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand-500', !r.name.trim() && !r.known && !r.internal ? 'border-amber-500' : 'border-transparent')}
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <h3 className="flex items-center gap-3 text-base font-bold text-zinc-900 sm:col-span-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarPlus className="size-4" />
            </span>
            Access window
          </h3>
          <Field label="Access starts">
            <Input type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Access ends" hint="Includes time to view records after the training. Can be extended later.">
            <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <h3 className="flex items-center gap-3 text-base font-bold text-zinc-900 sm:col-span-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <GraduationCap className="size-4" />
            </span>
            Add them to
          </h3>
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

        <section>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="size-4 accent-brand-600" />
            <Mail className="size-4 text-zinc-500" /> Email each person their sign-in link
          </label>
        </section>
      </div>
    </FullPageDialog>
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

type Filter = 'all' | 'active' | 'pending' | 'expiring' | 'ended' | 'guests'

/** Turns guest self sign-up on or off and sets how long new guest accounts last. */
function GuestSignupModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useAdmin()
  const current = publicAccessSettings(data)
  const [enabled, setEnabled] = useState(current.enabled)
  const [days, setDays] = useState(String(current.accessDays))
  const valid = Number(days) >= 1 && Number(days) <= 365
  const publicCount = data.trainings.filter((t) => t.isPublic && t.status !== 'CANCELLED').length
  const save = () => {
    update((d) => ({ ...d, publicAccess: { enabled, accessDays: Number(days) } }), {
      action: 'Updated guest sign-up',
      target: enabled ? `Open · ${days} days` : 'Closed',
      changes: [
        { field: 'Sign-up', from: current.enabled ? 'Open' : 'Closed', to: enabled ? 'Open' : 'Closed' },
        { field: 'Access days', from: String(current.accessDays), to: days },
      ],
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Guest sign-up"
      description="People outside the company can create a guest account from the sign-in page and join public trainings."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200/90 p-4 transition hover:bg-zinc-50/80">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
          <span>
            <span className="block text-sm font-semibold text-zinc-900">Allow guest sign-up</span>
            <span className="mt-0.5 block text-xs text-zinc-500">Shows “Create a guest account” on the sign-in page. Existing guests can still sign in when it’s off.</span>
          </span>
        </label>
        <Field label="New guest accounts last (days)" hint="Between 1 and 365. You can extend any guest later.">
          <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} disabled={!enabled} />
        </Field>
        <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
          Guests see <b>{publicCount} public training{publicCount === 1 ? '' : 's'}</b> right now, plus the public built-in courses. Make a training public from its page (⋯ → Make public) or when scheduling it.
        </p>
      </div>
    </Modal>
  )
}

const GuestPill = () => (
  <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase" title="Signed up as a guest">
    Guest
  </span>
)

export function AdminTemporaryAccess() {
  const { data, update } = useAdmin()
  const { toast, confirm } = useFeedback()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [inviting, setInviting] = useState(false)
  const [guestSettings, setGuestSettings] = useState(false)
  const [extending, setExtending] = useState<Person | null>(null)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Person | null>(null)
  const [page, setPage] = useState(0)
  const [pageSizeOption, setPageSizeOption] = useState<number | 'fit'>('fit')
  const [fitPageSize, setFitPageSize] = useState(10)
  const filtersRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const paginationRef = useRef<HTMLDivElement>(null)

  const temps = useMemo(() => data.people.filter(isTemporary).map((p) => ({ p, state: accessState(p) })), [data.people])
  const match = (s: AccessState, f: Filter) =>
    f === 'all' || (f === 'active' && (s === 'active' || s === 'expiring')) || (f === 'pending' && (s === 'pending' || s === 'scheduled')) || (f === 'expiring' && s === 'expiring') || (f === 'ended' && (s === 'expired' || s === 'revoked'))
  const inFilter = (p: Person, s: AccessState, f: Filter) => (f === 'guests' ? isGuest(p) : match(s, f))
  const rows = temps.filter(({ p, state }) => inFilter(p, state, filter) && (!q || `${p.name} ${p.email} ${p.organization ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const pageSize = pageSizeOption === 'fit' ? fitPageSize : pageSizeOption
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize)
  const count = (f: Filter) => temps.filter(({ p, state }) => inFilter(p, state, f)).length

  useEffect(() => {
    const table = tableRef.current
    const pagination = paginationRef.current
    if (!table || !pagination) return

    const measureFit = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) return
      const firstRow = table.querySelector('tbody tr')
      const rowHeight = firstRow?.getBoundingClientRect().height ?? 0
      const headerHeight = table.querySelector('thead')?.getBoundingClientRect().height ?? 0
      if (!rowHeight || !headerHeight) return

      const scroller = table.closest('main')?.parentElement
      const scrollerRect = scroller?.getBoundingClientRect()
      const availableHeight = (scroller?.clientHeight ?? window.innerHeight) - 32
      const top = scroller && scrollerRect
        ? table.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop
        : table.getBoundingClientRect().top
      const pagerHeight = pagination.getBoundingClientRect().height
      const pagerGap = Number.parseFloat(getComputedStyle(pagination).marginTop) || 0
      const nextFit = Math.max(1, Math.min(50, Math.floor((availableHeight - top - headerHeight - pagerHeight - pagerGap) / rowHeight)))
      setFitPageSize((currentFit) => currentFit === nextFit ? currentFit : nextFit)
    }

    const observer = new ResizeObserver(measureFit)
    observer.observe(table)
    observer.observe(pagination)
    if (filtersRef.current) observer.observe(filtersRef.current)
    window.addEventListener('resize', measureFit)
    const frame = window.requestAnimationFrame(measureFit)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measureFit)
      observer.disconnect()
    }
  }, [pageRows.length > 0])

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
        description="External trainees invited by email and guests who signed up themselves. Each has an access window; they sign in with a code."
        actions={
          <>
            <Button onClick={() => setGuestSettings(true)}>
              <Globe2 className="size-4" /> Guest sign-up
            </Button>
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
      <div ref={filtersRef}>
        <TabBar>
          <Tabs<Filter>
            value={filter}
            onChange={(next) => { setFilter(next); setPage(0) }}
            items={(
              [
                ['all', 'All'],
                ['active', 'Active'],
                ['pending', 'Not signed in yet'],
                ['expiring', 'Expiring soon'],
                ['ended', 'Expired / revoked'],
                ['guests', 'Guests'],
              ] as [Filter, string][]
            ).map(([value, label]) => ({ value, label, count: count(value) }))}
          />
          <SearchInput value={q} onChange={(value) => { setQ(value); setPage(0) }} placeholder="Search by name/email…" className="w-full sm:w-[280px]" />
        </TabBar>
      </div>

      {rows.length ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {pageRows.map(({ p, state }) => {
              const left = daysLeft(p)
              return (
                <Card key={p.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setViewing(p)} className="flex min-w-0 items-center gap-3 text-left">
                      <Avatar name={p.name} size="sm" />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium text-zinc-900">
                          <span className="truncate">{p.name}</span>
                          {isGuest(p) && <GuestPill />}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      </span>
                    </button>
                    <Badge tone={stateTone[state]}>{accessLabel[state].toUpperCase()}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 text-sm text-zinc-600">
                    <span className="truncate">Organization: {p.organization || '—'}</span>
                    <span className="truncate">Trainings: {trainingsFor(p.id, data.trainings).length}</span>
                    <span className="truncate">Access: {p.accessStart ? shortDate(p.accessStart) : '—'} – {p.accessEnd ? shortDate(p.accessEnd) : '—'}</span>
                    <span className="truncate">Last sign-in: {p.lastSignInAt ? dateTime(p.lastSignInAt) : p.acceptedAt ? dateTime(p.acceptedAt) : 'Never'}</span>
                    {left !== null && state !== 'revoked' && (
                      <span className={cn('col-span-2 text-xs', left < 0 ? 'text-brand-600' : left <= 7 ? 'text-amber-700' : 'text-zinc-500')}>
                        {left < 0 ? `Ended ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-2">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(p)}>View details</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingPerson(p)}>Edit invite</Button>
                    <Button size="sm" variant="ghost" onClick={() => setExtending(p)}>Extend access</Button>
                    <Button size="sm" variant="ghost" onClick={() => copy(p)}>Copy sign-in link</Button>
                    <Button size="sm" variant="ghost" onClick={() => { update((d) => d, { action: 'Resent invite email', target: p.name, silent: true }); toast(`Invite email resent to ${p.email}`) }}>Resend invite</Button>
                    {state === 'revoked' ? (
                      <Button size="sm" variant="ghost" onClick={() => setRevoked(p, false)}>Restore access</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRevoked(p, true)}>Revoke access</Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          <div ref={tableRef} className="hidden overflow-visible rounded-2xl border border-zinc-200/80 bg-surface md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="w-[43%] px-1.5 py-3 sm:px-2 lg:w-[34%] xl:w-[30%]" scope="col">User</th>
                  <th className="hidden px-1.5 py-3 sm:px-2 lg:table-cell lg:w-[18%] xl:w-[16%]" scope="col">Organization</th>
                  <th className="w-[30%] px-1.5 py-3 sm:px-2 lg:w-[24%] xl:w-[21%]" scope="col">Access</th>
                  <th className="w-[17%] px-1 py-3 sm:px-1 lg:w-[12%]" scope="col">Status</th>
                  <th className="hidden px-1.5 py-3 sm:px-2 lg:table-cell lg:w-[8%] xl:w-[7%]" scope="col">Trainings</th>
                  <th className="hidden px-1.5 py-3 sm:px-2 xl:table-cell xl:w-[10%]" scope="col">Last sign-in</th>
                  <th className="w-[10%] px-0 py-3 text-center lg:w-[4%]" scope="col" title="Actions"><span className="sr-only">Actions</span><MoreHorizontal className="mx-auto size-4" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/90 text-zinc-800">
                {pageRows.map(({ p, state }) => {
                  const left = daysLeft(p)
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50">
                      <td className="min-w-0 px-1.5 py-2 sm:px-2">
                        <button onClick={() => setViewing(p)} className="flex min-w-0 items-center gap-2.5 text-left">
                          <Avatar name={p.name} size="sm" />
                          <span className="min-w-0 leading-tight">
                            <span className="flex min-w-0 items-center gap-1.5 font-medium text-zinc-900">
                              <span className="truncate">{p.name}</span>
                              {isGuest(p) && <GuestPill />}
                            </span>
                            <span className="block truncate text-xs text-zinc-500" title={p.email}>{p.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="hidden px-1.5 py-2 text-sm text-zinc-600 lg:table-cell sm:px-2"><span className="block truncate" title={p.organization}>{p.organization || '—'}</span></td>
                      <td className="px-1.5 py-2 text-sm text-zinc-600 sm:px-2">
                        <span className="block truncate leading-tight">{p.accessStart ? shortDate(p.accessStart) : '—'} – {p.accessEnd ? shortDate(p.accessEnd) : '—'}</span>
                        {left !== null && state !== 'revoked' && (
                          <span className={cn('block truncate text-xs', left < 0 ? 'text-brand-600' : left <= 7 ? 'text-amber-700' : 'text-zinc-500')}>
                            {left < 0 ? `Ended ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-2 sm:px-1"><Badge className="max-w-full truncate px-1.5" tone={stateTone[state]}>{accessLabel[state].toUpperCase()}</Badge></td>
                      <td className="hidden px-1.5 py-2 text-sm text-zinc-600 lg:table-cell sm:px-2">{trainingsFor(p.id, data.trainings).length}</td>
                      <td className="hidden px-1.5 py-2 text-sm text-zinc-600 xl:table-cell" title={p.lastSignInAt ? dateTime(p.lastSignInAt) : p.acceptedAt ? dateTime(p.acceptedAt) : 'Never'}><span className="block truncate">{p.lastSignInAt ? dateTime(p.lastSignInAt) : p.acceptedAt ? dateTime(p.acceptedAt) : 'Never'}</span></td>
                      <td className="relative px-0 py-2 text-center">
                        <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Actions for ${p.name}`}>
                          <MoreHorizontal className="size-4" />
                        </button>
                        {menu === p.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                            <div className="absolute right-4 z-20 mt-1 w-52 rounded-xl border border-zinc-200 bg-surface p-1 text-left text-sm shadow-lg">
                              <button onClick={() => (setViewing(p), setMenu(null))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><Eye className="size-4" /> View details</button>
                              <button onClick={() => (setEditingPerson(p), setMenu(null))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><Pencil className="size-4" /> Edit invite</button>
                              <button onClick={() => (setExtending(p), setMenu(null))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><CalendarPlus className="size-4" /> Extend access</button>
                              <button onClick={() => copy(p)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><Copy className="size-4" /> Copy sign-in link</button>
                              <button onClick={() => { setMenu(null); update((d) => d, { action: 'Resent invite email', target: p.name, silent: true }); toast(`Invite email resent to ${p.email}`) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><Mail className="size-4" /> Resend invite</button>
                              {state === 'revoked' ? (
                                <button onClick={() => setRevoked(p, false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-100"><RotateCcw className="size-4" /> Restore access</button>
                              ) : (
                                <button onClick={() => setRevoked(p, true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-brand-700 hover:bg-brand-50"><Ban className="size-4" /> Revoke access</button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Card>
          <Empty icon={Users} title="No temporary users here" text="Invite external trainees to give them time-limited access." action={<Button onClick={() => setInviting(true)}>Invite</Button>} />
        </Card>
      )}

      {!!rows.length && (
        <div ref={paginationRef} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Showing {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} of {rows.length} users</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2">Rows per page<Select value={String(pageSizeOption)} onChange={(event) => { const value = event.target.value; setPageSizeOption(value === 'fit' ? 'fit' : Number(value)); setPage(0) }} className="w-auto! py-1.5! text-xs!"><option value="fit">Fit page ({fitPageSize})</option><option value="10">10</option><option value="25">25</option><option value="50">50</option></Select></label>
            <span className="px-1">Page {current + 1} of {pages}</span>
            <Button size="sm" aria-label="First page" disabled={current === 0} onClick={() => setPage(0)}><ChevronLeft className="size-3.5" /><ChevronLeft className="-ml-2 size-3.5" /></Button>
            <Button size="sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="size-3.5" /></Button>
            <Button size="sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight className="size-3.5" /></Button>
            <Button size="sm" aria-label="Last page" disabled={current >= pages - 1} onClick={() => setPage(pages - 1)}><ChevronRight className="size-3.5" /><ChevronRight className="-ml-2 size-3.5" /></Button>
          </div>
        </div>
      )}

      {inviting && <InviteTemporaryModal onClose={() => setInviting(false)} />}
      {guestSettings && <GuestSignupModal onClose={() => setGuestSettings(false)} />}
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
