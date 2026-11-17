import { Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Button, Field, Input, Modal } from '../admin/ui'
import { isInternalEmail } from '../admin/requests'
import { loadAdminData, saveAdminData } from '../admin/storage'
import { DEMO_PASSWORD } from '../data/trainings'
import { customPassword, passwordProblem, setPassword } from '../lib/profileRequests'
import { useAuth } from '../store/Auth'
import { useFeedback } from './Feedback'

/** Company staff (Safaricom / M-PESA email). */
export const isStaffAccount = (email: string) => isInternalEmail(email)

/**
 * Edit your own contact details. Name and email come from your account and can't be changed here;
 * mobile number and job title save straight away (no approval needed).
 */
export function EditProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth()
  const { toast } = useFeedback()
  const [phone, setPhone] = useState((user.phone ?? '').replace(/\D/g, '').replace(/^(251|0)/, ''))
  const [role, setRole] = useState(user.role)
  const [tried, setTried] = useState(false)
  const phoneOk = /^[79]\d{8}$/.test(phone)
  const changed = `0${phone}` !== (user.phone ?? '') || role.trim() !== user.role

  const save = () => {
    setTried(true)
    if (!phoneOk || !role.trim()) return
    const nextPhone = `0${phone}`
    const data = loadAdminData()
    saveAdminData({ ...data, people: data.people.map((x) => (x.email.toLowerCase() === user.email.toLowerCase() ? { ...x, phone: nextPhone, designation: role.trim() || x.designation } : x)) })
    updateUser({ ...user, phone: nextPhone, role: role.trim() })
    toast('Profile updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile details"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!changed}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              Full name <Lock className="size-3 text-zinc-400" aria-label="Can't be changed" />
            </p>
            <p className="truncate rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">{user.name}</p>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              Email <Lock className="size-3 text-zinc-400" aria-label="Can't be changed" />
            </p>
            <p className="truncate rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">{user.email}</p>
          </div>
        </div>
        <Field label="Mobile number">
          <span className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-zinc-200 pr-2.5 pl-3 text-sm font-semibold text-zinc-700">+251</span>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={9}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
              placeholder="9XX XXX XXX"
              aria-invalid={tried && !phoneOk}
              className="pl-[4.25rem] tracking-wide"
            />
          </span>
        </Field>
        {tried && !phoneOk && <p className="-mt-2 text-xs text-brand-600">Enter the 9 digits after +251, starting with 9 or 7.</p>}
        <Field label="Job title">
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
        {tried && !role.trim() && <p className="-mt-2 text-xs text-brand-600">Enter your job title.</p>}
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

/** Just the Edit details + Change password buttons (no status banner). */
export function AccountActionButtons({ onDialog }: { onDialog: (d: 'edit' | 'password') => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onDialog('edit')}
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
  return (
    <>
      <AccountActionButtons onDialog={setDialog} />
      {dialog === 'edit' && <EditProfileDialog onClose={() => setDialog(null)} />}
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
    </>
  )
}
