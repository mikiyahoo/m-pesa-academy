import { ArrowRight, CheckCircle2, Clock, Eye, EyeOff, KeyRound, Lock, Mail, Send, Unlock, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Input, Modal, Textarea } from '../admin/ui'
import { isInternalEmail } from '../admin/requests'
import { loadAdminData, saveAdminData } from '../admin/storage'
import { DEMO_PASSWORD } from '../data/trainings'
import {
  approvedDetails,
  cancelProfileRequest,
  customPassword,
  myLatestRequest,
  onProfileRequestsChange,
  passwordProblem,
  setPassword,
  submitProfileRequest,
  updateProfileRequest,
  type ProfileChange,
  type ProfileField,
  type ProfileRequest,
} from '../lib/profileRequests'
import { useAuth } from '../store/Auth'
import { useFeedback } from './Feedback'

/** Company staff (Safaricom / M-PESA email) keep directory details: changes need an admin's approval. */
export const isStaffAccount = (email: string) => isInternalEmail(email)

const LABELS: Record<ProfileField, string> = { name: 'Full name', email: 'Email', phone: 'Phone', role: 'Job title' }

/** Where profile requests go: the training admins' shared inbox, or the first admin. */
function adminInbox() {
  const admin = loadAdminData().people.find((p) => p.role === 'Admin' && p.status === 'Active')
  return admin ? `${admin.name} <${admin.email}>` : 'Learning & Development <learning@safaricom.et>'
}

function draftFor(name: string, email: string, changes: ProfileChange[]) {
  const subject = `Profile change request — ${name}`
  const lines = changes.map((c) => `• ${c.label}: ${c.from || '—'} → ${c.to || '—'}`)
  const body = [
    'Hello Learning & Development team,',
    '',
    'Please update my M-PESA Academy profile with the details below:',
    '',
    ...lines,
    '',
    changes.some((c) => c.field === 'email') ? 'The company has given me a new work email.\n' : '',
    'Thank you,',
    name,
    email,
  ]
    .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
    .join('\n')
  return { subject, body }
}

/** Edit name, email, phone and job title. Staff send an editable email draft for approval; others save directly. */
export function EditProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth()
  const { toast } = useFeedback()
  const staff = isStaffAccount(user.email)
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, role: user.role })
  const [editableIdentity, setEditableIdentity] = useState({ name: false, email: false })
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null)
  const [error, setError] = useState('')

  const changes: ProfileChange[] = (Object.keys(LABELS) as ProfileField[])
    .filter((f) => form[f].trim() !== (user[f] ?? '').trim())
    .map((f) => ({ field: f, label: LABELS[f], from: user[f] ?? '', to: form[f].trim() }))

  const validate = () => {
    if (!form.name.trim()) return 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Enter a valid email address.'
    if (staff && form.email.trim().toLowerCase() !== user.email.toLowerCase() && !isInternalEmail(form.email)) return 'Staff emails must stay on a company domain (@safaricom.et or @mpesa.et).'
    if (!/^\+?\d[\d\s-]{6,}$/.test(form.phone.trim())) return 'Enter a valid phone number.'
    return ''
  }

  const next = () => {
    const problem = validate()
    setError(problem)
    if (problem || !changes.length) return
    if (staff) {
      setDraft(draftFor(user.name, user.email, changes))
      return
    }
    // Guests and external trainees own their details.
    const data = loadAdminData()
    saveAdminData({ ...data, people: data.people.map((p) => (p.email.toLowerCase() === user.email.toLowerCase() ? { ...p, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), designation: form.role.trim() || p.designation } : p)) })
    updateUser({ ...user, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role.trim() })
    toast('Profile updated')
    onClose()
  }

  const send = () => {
    if (!draft) return
    submitProfileRequest({ personEmail: user.email, personName: user.name, changes, subject: draft.subject.trim(), body: draft.body.trim() })
    toast('Request sent — your details change once an admin approves it')
    onClose()
  }

  if (draft)
    return (
      <Modal
        open
        wide
        onClose={onClose}
        title="Send change request"
        description="Company staff details come from the directory, so an admin approves changes. Review the email below — you can edit the subject and message."
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Back</Button>
            <Button variant="primary" onClick={send} disabled={!draft.subject.trim() || !draft.body.trim()}>
              <Send className="size-4" /> Send to admin
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 text-sm sm:grid-cols-[4rem_1fr]">
            <span className="text-xs font-semibold text-zinc-500">To</span>
            <span className="font-medium text-zinc-900">{adminInbox()}</span>
            <span className="text-xs font-semibold text-zinc-500">From</span>
            <span className="text-zinc-700">
              {user.name} &lt;{user.email}&gt;
            </span>
          </div>
          <Field label="Subject">
            <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </Field>
          <Field label="Message">
            <Textarea rows={11} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="text-sm leading-relaxed" />
          </Field>
        </div>
      </Modal>
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile details"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={next} disabled={!changes.length}>
            {staff ? (
              <>
                Review request <ArrowRight className="size-4" />
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="profile-full-name" className="mb-1.5 block text-sm font-medium text-zinc-700">Full name</label>
          <div className="relative">
            <Input id="profile-full-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} readOnly={!editableIdentity.name} className="pr-11" />
            <button
              type="button"
              onClick={() => setEditableIdentity((fields) => ({ ...fields, name: !fields.name }))}
              aria-label={editableIdentity.name ? 'Lock full name' : 'Edit full name'}
              aria-pressed={editableIdentity.name}
              title={editableIdentity.name ? 'Lock full name' : 'Edit full name'}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
              {editableIdentity.name ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium text-zinc-700">Email</label>
          <div className="relative">
            <Input id="profile-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} readOnly={!editableIdentity.email} className="pr-11" />
            <button
              type="button"
              onClick={() => setEditableIdentity((fields) => ({ ...fields, email: !fields.email }))}
              aria-label={editableIdentity.email ? 'Lock email' : 'Edit email'}
              aria-pressed={editableIdentity.email}
              title={editableIdentity.email ? 'Lock email' : 'Edit email'}
              className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
              {editableIdentity.email ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Job title">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </Field>
        </div>
        {error && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{error}</p>}
        {changes.length > 0 && !error && (
          <p className="text-xs text-zinc-500">
            Changing: {changes.map((c) => c.label.toLowerCase()).join(', ')}
          </p>
        )}
      </div>
    </Modal>
  )
}

function PasswordInput({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} autoComplete="new-password" className="pr-10" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  )
}

/** Anyone who signs in with a password can change it straight away — no approval needed. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { user, personId } = useAuth()
  const { toast } = useFeedback()
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  // Guests and invited externals sign in with a one-time code instead.
  const codeOnly = !!personId && !isStaffAccount(user.email)

  const save = () => {
    const actual = customPassword(user.email) ?? DEMO_PASSWORD
    const problem = current !== actual ? 'Your current password is not correct.' : passwordProblem(pw) ?? (pw !== confirmPw ? 'The new passwords don’t match.' : pw === current ? 'Choose a password you haven’t used here.' : null)
    setError(problem ?? '')
    if (problem) return
    setPassword(user.email, pw)
    toast('Password changed — use it next time you sign in')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change password"
      footer={
        codeOnly ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!current || !pw || !confirmPw}>
              <KeyRound className="size-4" /> Change password
            </Button>
          </>
        )
      }
    >
      {codeOnly ? (
        <p className="text-sm text-zinc-600">You sign in with a one-time code sent to your phone, so there is no password to change.</p>
      ) : (
        <div className="space-y-4">
          <PasswordInput label="Current password" value={current} onChange={setCurrent} autoFocus />
          <PasswordInput label="New password" value={pw} onChange={setPw} />
          <PasswordInput label="Confirm new password" value={confirmPw} onChange={setConfirmPw} />
          {error && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

/** Live view of my latest change request; applies approved details to this session. */
export function useMyProfileRequest() {
  const { user, updateUser } = useAuth()
  const [tick, setTick] = useState(0)
  useEffect(() => onProfileRequestsChange(() => setTick((n) => n + 1)), [])
  const request = useMemo(() => myLatestRequest(user.email), [user.email, tick])

  useEffect(() => {
    if (request?.status !== 'approved' || request.appliedAt) return
    updateUser(approvedDetails({ ...user, email: request.personEmail }))
    updateProfileRequest(request.id, { appliedAt: new Date().toISOString() })
  }, [request, user, updateUser])
  return request
}

/** Status line for the latest request: waiting, approved or declined. */
export function ProfileRequestStatus({ request }: { request?: ProfileRequest }) {
  const [hidden, setHidden] = useState(false)
  if (!request || hidden) return null
  const when = new Date(request.reviewedAt ?? request.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const what = request.changes.map((c) => c.label.toLowerCase()).join(', ')
  if (request.status === 'pending')
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-amber-900">Waiting for admin approval</span>
          <span className="block text-xs text-amber-800">
            Sent {when}: {what}
          </span>
        </span>
        <button type="button" onClick={() => cancelProfileRequest(request.id)} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-amber-700/20 bg-white/70 px-3 text-xs font-semibold text-amber-900 transition hover:bg-white">
          Cancel request
        </button>
      </div>
    )
  const approved = request.status === 'approved'
  return (
    <div className={`mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm ${approved ? 'border-mpesa-500/25 bg-mpesa-500/10' : 'border-brand-200 bg-brand-50'}`}>
      {approved ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mpesa-700" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-brand-700" />}
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${approved ? 'text-mpesa-800' : 'text-brand-800'}`}>{approved ? 'Your profile change was approved' : 'Your profile change was declined'}</span>
        <span className="block text-xs text-zinc-600">
          {when}
          {request.reviewedBy ? ` · ${request.reviewedBy}` : ''}
          {request.note ? ` · “${request.note}”` : ''}
        </span>
      </span>
      <button type="button" onClick={() => setHidden(true)} className="shrink-0 text-xs font-semibold text-zinc-600 hover:underline">
        Dismiss
      </button>
    </div>
  )
}

/** Just the Edit details + Change password buttons (no status banner). */
export function AccountActionButtons({ request, onDialog }: { request: ReturnType<typeof useMyProfileRequest>; onDialog: (d: 'edit' | 'password') => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onDialog('edit')}
        disabled={request?.status === 'pending'}
        title={request?.status === 'pending' ? 'Wait for your current request, or cancel it first.' : undefined}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        <Mail className="size-4" /> Edit details
      </button>
      <button type="button" onClick={() => onDialog('password')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
        <KeyRound className="size-4" /> Change password
      </button>
    </div>
  )
}

/** Buttons for the account card: edit details and change password (no status banner). */
export function AccountActions() {
  const [dialog, setDialog] = useState<'edit' | 'password' | null>(null)
  const request = useMyProfileRequest()
  return (
    <>
      <AccountActionButtons request={request} onDialog={setDialog} />
      {dialog === 'edit' && <EditProfileDialog onClose={() => setDialog(null)} />}
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
    </>
  )
}

/** Just the request status banner (Waiting / approved / declined), no buttons. */
export function AccountRequestStatus() {
  const request = useMyProfileRequest()
  return <ProfileRequestStatus request={request} />
}
