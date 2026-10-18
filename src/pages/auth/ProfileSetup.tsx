import { AlertCircle, Loader2, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { loadAdminData, saveAdminData } from '../../admin/storage'
import { PROFILE_FIELDS, REGIONS } from '../../admin/temporary'
import type { Person } from '../../admin/types'
import { useAuth } from '../../store/Auth'
import { AuthShell } from './AuthShell'

type Key = (typeof PROFILE_FIELDS)[number]['key']

/** First-login prompt for details AD or the invite didn't provide (TE-1.1). */
export function ProfileSetup({ person, onDone }: { person: Person; onDone: () => void }) {
  const { user, updateUser, logout } = useAuth()
  const [form, setForm] = useState<Record<Key, string>>({
    designation: person.designation ?? '',
    organization: person.organization ?? '',
    department: person.department ?? '',
    region: person.region ?? '',
  })
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const missing = PROFILE_FIELDS.filter((f) => !form[f.key].trim())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (missing.length) return
    setSaving(true)
    const data = loadAdminData()
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Record<Key, string>
    saveAdminData({ ...data, people: data.people.map((p) => (p.id === person.id ? { ...p, ...clean } : p)) })
    updateUser({ ...user, role: `${clean.designation} · ${clean.organization}` })
    setTimeout(onDone, 300)
  }

  const input = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

  return (
    <AuthShell>
      <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <UserRound className="size-6" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">Complete your profile</h2>
      <p className="mt-1 text-sm text-zinc-600">These details appear on your attendance records and certificates. You only need to do this once.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <p className="mt-1 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">{person.name}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <p className="mt-1 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">{person.email}</p>
        </div>
        {PROFILE_FIELDS.map((f) => {
          const bad = tried && !form[f.key].trim()
          return (
            <label key={f.key} className="block">
              <span className="text-sm font-medium text-zinc-700">
                {f.label} <span className="text-brand-600">*</span>
              </span>
              {f.key === 'region' ? (
                <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} aria-invalid={bad} className={`${input} mt-1.5 ${bad ? 'border-brand-500' : 'border-zinc-200'}`}>
                  <option value="">Choose your region…</option>
                  {REGIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={bad} className={`${input} mt-1.5 ${bad ? 'border-brand-500' : 'border-zinc-200'}`} />
              )}
              {bad && (
                <span className="mt-1 flex items-center gap-1 text-xs text-brand-700">
                  <AlertCircle className="size-3.5" /> Required
                </span>
              )}
            </label>
          )
        })}
        <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70">
          {saving && <Loader2 className="size-4 animate-spin" />} Save and continue
        </button>
        <button type="button" onClick={() => logout()} className="w-full text-center text-sm text-zinc-500 hover:text-zinc-800">
          Sign out
        </button>
      </form>
    </AuthShell>
  )
}
