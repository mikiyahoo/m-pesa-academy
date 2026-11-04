import { ArrowRight, Check, Mail, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { UserAvatar } from '../components/UserAvatar'
import { loadProfileRequests, onProfileRequestsChange, updateProfileRequest, type ProfileRequest } from '../lib/profileRequests'
import { useAuth } from '../store/Auth'
import { useAdmin } from './store'
import { Badge, Button, Field, Modal, Textarea } from './ui'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Profile change requests from staff, shown on the Users page for admins to approve or decline. */
export function ProfileRequestsPanel() {
  const [requests, setRequests] = useState<ProfileRequest[]>(() => loadProfileRequests().filter((r) => r.status === 'pending'))
  useEffect(() => onProfileRequestsChange(() => setRequests(loadProfileRequests().filter((r) => r.status === 'pending'))), [])
  const [open, setOpen] = useState<ProfileRequest | null>(null)
  if (!requests.length) return null
  return (
    <section className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5" aria-label="Profile change requests">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-amber-700" />
        <h2 className="text-base font-bold text-zinc-900">Profile change requests</h2>
        <Badge tone="amber">{requests.length} waiting</Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-surface px-3.5 py-3">
            <UserAvatar name={r.personName} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-900">{r.personName}</span>
              <span className="block truncate text-xs text-zinc-500">
                {r.changes.map((c) => c.label).join(', ')} · {when(r.createdAt)}
              </span>
            </span>
            <Button size="sm" variant="primary" onClick={() => setOpen(r)}>
              Review
            </Button>
          </li>
        ))}
      </ul>
      {open && <ReviewModal request={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function ReviewModal({ request: r, onClose }: { request: ProfileRequest; onClose: () => void }) {
  const { update } = useAdmin()
  const { user } = useAuth()
  const { toast } = useFeedback()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')

  const approve = () => {
    const value = (f: string) => r.changes.find((c) => c.field === f)?.to
    update(
      (d) => ({
        ...d,
        people: d.people.map((p) =>
          p.email.toLowerCase() === r.personEmail.toLowerCase()
            ? { ...p, name: value('name') ?? p.name, email: value('email') ?? p.email, phone: value('phone') ?? p.phone, designation: value('role') ?? p.designation }
            : p,
        ),
      }),
      { action: 'Approved profile change', target: r.personName, changes: r.changes.map((c) => ({ field: c.label, from: c.from, to: c.to })) },
    )
    updateProfileRequest(r.id, { status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: user.name })
    onClose()
  }
  const decline = () => {
    updateProfileRequest(r.id, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: user.name, note: note.trim() || undefined })
    update((d) => d, { action: 'Declined profile change', target: r.personName, silent: true, remarks: note.trim() || undefined })
    toast(`Declined — ${r.personName} sees your reason on their profile`)
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={r.subject}
      description={`From ${r.personName} <${r.personEmail}> · ${when(r.createdAt)}`}
      footer={
        declining ? (
          <>
            <Button onClick={() => setDeclining(false)}>Back</Button>
            <Button variant="danger" onClick={decline}>
              <X className="size-4" /> Decline request
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setDeclining(true)}>Decline</Button>
            <Button variant="primary" onClick={approve}>
              <Check className="size-4" /> Approve and update
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-zinc-900">Requested changes</p>
          <ul className="space-y-2">
            {r.changes.map((c) => (
              <li key={c.field} className="rounded-xl border border-zinc-200/80 p-3">
                <p className="text-xs font-semibold text-zinc-500">{c.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-zinc-500 line-through">{c.from || '—'}</span>
                  <ArrowRight className="size-3.5 text-zinc-400" />
                  <span className="font-semibold text-zinc-900">{c.to || '—'}</span>
                </p>
              </li>
            ))}
          </ul>
          {declining && (
            <div className="mt-4">
              <Field label="Reason (shown to the person)">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please use the email HR gave you." autoFocus />
              </Field>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-zinc-900">Their message</p>
          <pre className="max-h-80 overflow-y-auto rounded-xl bg-zinc-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 scrollbar-thin">{r.body}</pre>
        </div>
      </div>
    </Modal>
  )
}
