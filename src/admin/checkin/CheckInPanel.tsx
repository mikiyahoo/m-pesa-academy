import QRCode from 'qrcode'
import { AlertCircle, Check, Download, Link2, QrCode, Send, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFeedback } from '../../components/Feedback'
import { localISO } from '../../lib/utils'
import { useAdmin } from '../store'
import { parseParticipants } from '../requests'
import { addCheckin, checkinLink, rotatingToken, statusFor, tokenCountdown } from './checkin'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Field, Modal, Select, Textarea } from '../ui'
import type { AdminTraining, Checkin, CheckinMethod, CheckinStatus } from '../types'

const methodLabel: Record<CheckinMethod, string> = {
  qr: 'QR scan',
  link: 'Unique link',
  manual: 'Manual',
  offline: 'Offline import',
}

const statusTone: Record<CheckinStatus, 'green' | 'amber'> = { Present: 'green', Late: 'amber' }

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 15.5
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid size-10 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e4e4e7" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#d03c3b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(seconds / total) * c} ${c}`}
        />
      </svg>
      <span className="text-[11px] font-bold tabular-nums text-zinc-700">{seconds}</span>
    </span>
  )
}

function ManualMarkModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const checkedIn = new Set((training.checkins ?? []).map((c) => c.personId))
  const available = training.participantIds.map((pid) => data.people.find((p) => p.id === pid)).filter((p) => p && !checkedIn.has(p.id))
  const [personId, setPersonId] = useState(available[0]?.id ?? '')
  const [status, setStatus] = useState<CheckinStatus>('Present')
  const [comment, setComment] = useState('')
  const valid = !!personId && comment.trim().length > 0

  const save = () => {
    const person = data.people.find((p) => p.id === personId)
    if (!person) return
    const entry: Checkin = {
      personId,
      at: localISO(),
      method: 'manual',
      status,
      comment: comment.trim(),
      verified: false,
      by: data.people.find((p) => p.role === 'Admin')?.name ?? 'Admin',
    }
    update(
      (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, checkins: addCheckin(t.checkins ?? [], entry) } : t)) }),
      { action: `Manually marked ${person.name} as ${status}`, target: training.name },
    )
    toast(`${person.name} marked ${status.toLowerCase()} — pending verification`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Manual mark"
      description="Manual entries need a reason and start unverified until an admin confirms them."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Mark present
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Participant">
          <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            {available.map((p) => (
              <option key={p!.id} value={p!.id}>
                {p!.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as CheckinStatus)}>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
          </Select>
        </Field>
        <Field label="Reason (required)">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. QR didn't scan — marked at the door" />
        </Field>
      </div>
    </Modal>
  )
}

function OfflineModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [text, setText] = useState('')
  const checkedIn = new Set((training.checkins ?? []).map((c) => c.personId))
  const { rows, errors } = text.trim() ? parseParticipants(text) : { rows: [], errors: [] }
  const matched = rows
    .map((r) => data.people.find((p) => p.email.toLowerCase() === r.email.toLowerCase()))
    .filter((p) => p && !checkedIn.has(p.id))
  const duplicates = rows.length - matched.length

  const save = () => {
    const now = localISO()
    const entries: Checkin[] = matched.map((p) => ({
      personId: p!.id,
      at: now,
      method: 'offline' as CheckinMethod,
      status: statusFor(training, now, data.attendanceRules.lateMinutes),
      verified: true,
      by: data.people.find((x) => x.role === 'Admin')?.name ?? 'Admin',
    }))
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) =>
          t.id === training.id ? { ...t, checkins: entries.reduce((list, e) => addCheckin(list, e), t.checkins ?? []) } : t,
        ),
      }),
      { action: `Imported ${entries.length} check-ins from the offline device`, target: training.name },
    )
    toast(`Imported ${entries.length} check-in${entries.length === 1 ? '' : 's'} from the offline device`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import offline check-ins"
      description="Paste the list the offline device collected (one name/email per line, or CSV). Duplicate entries are skipped."
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!matched.length} onClick={save}>
            Import {matched.length} check-in{matched.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <Field label="Participants">
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Awet Gebrehiwet, awet.gebrehiwet@partner.safaricom.et\nLelisa Asmare <lelisa.asmare@partner.safaricom.et>'} />
      </Field>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="text-mpesa-600">{matched.length} new</span>
        {duplicates > 0 && <span className="text-amber-600">{duplicates} already checked in / not found</span>}
        {errors.map((e) => (
          <span key={e} className="flex items-center gap-1 text-brand-600">
            <AlertCircle className="size-3.5" /> {e}
          </span>
        ))}
      </div>
    </Modal>
  )
}

export function CheckInPanel({ training }: { training: AdminTraining }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [now, setNow] = useState(Date.now())
  const [modal, setModal] = useState<null | 'manual' | 'offline'>(null)
  const [reminders, setReminders] = useState<{ at: string; count: number }[]>([])

  const rules = data.attendanceRules
  const session = training.checkinSession
  const open = !!session && !session.closedAt
  const checkins = training.checkins ?? []
  const lateMinutes = rules.lateMinutes

  // Tick while a session is open so the QR token rotates every 10 s.
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open])

  const token = session ? rotatingToken(session.token, now) : ''
  const link = token ? checkinLink(training.id, token) : ''
  const [qr, setQr] = useState('')
  useEffect(() => {
    if (!token) {
      setQr('')
      return
    }
    let alive = true
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: '#18181b', light: '#ffffff' } })
      .then((url) => {
        if (alive) setQr(url)
      })
      .catch(() => {
        if (alive) setQr('')
      })
    return () => {
      alive = false
    }
  }, [token, link])

  const byPerson = useMemo(() => new Map(checkins.map((c) => [c.personId, c])), [checkins])
  const participants = training.participantIds.map((pid) => data.people.find((p) => p.id === pid)).filter((p) => !!p)
  const notCheckedIn = participants.filter((p) => !byPerson.has(p.id))
  const present = checkins.filter((c) => c.status === 'Present').length
  const late = checkins.filter((c) => c.status === 'Late').length
  const rate = participants.length ? Math.round((checkins.length / participants.length) * 100) : 0
  const unverified = checkins.filter((c) => !c.verified)
  const sorted = [...checkins].sort((a, b) => a.at.localeCompare(b.at))

  const start = () => {
    update(
      (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, checkinSession: { startedAt: localISO(), token: `chk-${training.id}-${Date.now().toString(36)}` } } : t)) }),
      { action: 'Started attendance', target: training.name },
    )
    toast('Attendance started — the QR code and link are live')
  }

  const close = () => {
    if (!session) return
    update(
      (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, checkinSession: { ...session, closedAt: localISO() } } : t)) }),
      { action: 'Closed attendance', target: training.name },
    )
    toast('Attendance closed')
  }

  const simulate = () => {
    const next = notCheckedIn[0]
    if (!next) {
      toast('Everyone has already checked in', { tone: 'info' })
      return
    }
    const at = localISO()
    const entry: Checkin = {
      personId: next.id,
      at,
      method: 'qr',
      status: statusFor(training, at, lateMinutes),
      verified: true,
      by: 'Simulated scan',
    }
    update(
      (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, checkins: addCheckin(t.checkins ?? [], entry) } : t)) }),
      { action: `${next.name} checked in by QR scan`, target: training.name, silent: true },
    )
    toast(`${next.name} scanned the QR code — ${entry.status}`)
  }

  const remind = () => {
    if (!notCheckedIn.length) {
      toast('Everyone has checked in', { tone: 'info' })
      return
    }
    setReminders((r) => [{ at: localISO(), count: notCheckedIn.length }, ...r])
    toast(`Reminder sent to ${notCheckedIn.length} participant${notCheckedIn.length === 1 ? '' : 's'} (simulated)`)
  }

  const verify = (c: Checkin) => {
    const person = data.people.find((p) => p.id === c.personId)
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) =>
          t.id === training.id ? { ...t, checkins: (t.checkins ?? []).map((x) => (x.personId === c.personId ? { ...x, verified: true } : x)) } : t,
        ),
      }),
      { action: `Verified ${person?.name ?? 'participant'}'s check-in`, target: training.name, silent: true },
    )
    toast(`${person?.name ?? 'Participant'} verified`)
  }

  const exportCsv = () =>
    downloadCsv(
      `${training.name.replace(/[^\w-]+/g, '_')}_checkins.csv`,
      ['Participant', 'Email', 'Time', 'Method', 'Status', 'Verified', 'Comment', 'Recorded by'],
      sorted.map((c) => {
        const p = data.people.find((x) => x.id === c.personId)
        return [p?.name ?? '?', p?.email ?? '?', c.at, methodLabel[c.method], c.status, c.verified ? 'Yes' : 'No', c.comment ?? '', c.by]
      }),
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Unique check-in link copied')
    } catch {
      toast('Could not copy the link', { tone: 'error' })
    }
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-zinc-900">
            Check-in
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-600">
              <QrCode className="size-3" /> Self-service
            </span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Participants scan the QR code or open the unique link. Check-ins within {lateMinutes} min of the start count as Present, after that as Late.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open ? (
            <Button size="sm" variant="danger" onClick={close}>
              <X className="size-3.5" /> Close attendance
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={start}>
              <QrCode className="size-3.5" /> Start attendance
            </Button>
          )}
          {checkins.length > 0 && (
            <Button size="sm" onClick={exportCsv}>
              <Download className="size-3.5" /> Export
            </Button>
          )}
        </div>
      </div>

      {open && session && (
        <div className="flex flex-wrap items-center gap-5 border-b border-zinc-200 bg-zinc-50/60 px-5 py-4">
          <div className="flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-surface p-3">
            {qr ? (
              <img src={qr} alt="Check-in QR code" className="size-[110px] rounded-xl" />
            ) : (
              <span className="grid size-[110px] place-items-center rounded-xl bg-zinc-100 text-zinc-400">
                <QrCode className="size-10" />
              </span>
            )}
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <CountdownRing seconds={tokenCountdown(now)} total={10} /> Scanning code
              </p>
              <p className="mt-1 max-w-[240px] truncate text-xs text-zinc-500" title={link}>
                {link}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">The code changes every 10 s — screenshots expire.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={copy}>
              <Link2 className="size-3.5" /> Copy unique link
            </Button>
            <Button size="sm" variant="ghost" onClick={simulate}>
              <UserPlus className="size-3.5" /> Simulate a scan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setModal('manual')}>
              <UserPlus className="size-3.5" /> Manual mark
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setModal('offline')}>
              <Users className="size-3.5" /> Offline import
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 border-b border-zinc-200 p-5 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Checked in</p>
          <p className="mt-0.5 text-xl font-bold text-zinc-900">
            {checkins.length}
            <span className="text-sm font-medium text-zinc-400"> / {participants.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-2 rounded-full bg-mpesa-500" /> Present
          </p>
          <p className="mt-0.5 text-xl font-bold text-zinc-900">{present}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-2 rounded-full bg-amber-500" /> Late
          </p>
          <p className="mt-0.5 text-xl font-bold text-zinc-900">{late}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Attendance rate</p>
          <p className="mt-0.5 text-xl font-bold text-zinc-900">{rate}%</p>
        </div>
      </div>

      {open && notCheckedIn.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{notCheckedIn.length}</span> not checked in yet
          </p>
          <Button size="sm" onClick={remind}>
            <Send className="size-3.5" /> Remind {notCheckedIn.length}
          </Button>
        </div>
      )}

      {reminders.length > 0 && (
        <div className="border-b border-zinc-200 bg-amber-50/40 px-5 py-2.5 text-xs text-amber-800">
          {reminders.map((r) => (
            <p key={r.at}>
              {r.at} — reminder sent to {r.count} participant{r.count === 1 ? '' : 's'} (simulated)
            </p>
          ))}
        </div>
      )}

      {unverified.length > 0 && (
        <div className="border-b border-zinc-200 bg-brand-50/40 px-5 py-2.5 text-xs text-brand-700">
          {unverified.length} manual {unverified.length === 1 ? 'entry needs' : 'entries need'} verification
        </div>
      )}

      {sorted.length ? (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                {['Participant', 'Time', 'Method', 'Status', 'Verified', ''].map((h) => (
                  <th key={h} className="px-5 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((c) => {
                const p = data.people.find((x) => x.id === c.personId)
                return (
                  <tr key={c.personId} className="hover:bg-zinc-50">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={p?.name ?? '?'} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">{p?.name ?? 'Unknown'}</span>
                          <span className="block truncate text-xs text-zinc-500">{p?.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-700">{c.at.slice(11, 16)}</td>
                    <td className="px-5 py-2.5 text-zinc-700">{methodLabel[c.method]}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-2.5">
                      {c.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-mpesa-600">
                          <ShieldCheck className="size-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <AlertCircle className="size-3.5" /> Unverified
                        </span>
                      )}
                      {c.comment && <span className="mt-0.5 block text-[11px] text-zinc-400">“{c.comment}”</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {!c.verified && (
                        <Button size="sm" variant="ghost" onClick={() => verify(c)}>
                          <Check className="size-3.5" /> Verify
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={QrCode}
          title={open ? 'No check-ins yet' : session ? 'Attendance closed' : 'Attendance not started'}
          text={
            open
              ? 'Share the QR code or link — check-ins appear here as participants scan in.'
              : session
                ? `${checkins.length} recorded before closing.`
                : 'Start attendance to open the QR code and unique link.'
          }
          action={
            !open && !session ? (
              <Button variant="primary" onClick={start}>
                <QrCode className="size-4" /> Start attendance
              </Button>
            ) : undefined
          }
        />
      )}

      {notCheckedIn.length > 0 && sorted.length > 0 && (
        <div className="border-t border-zinc-200 p-5">
          <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Not checked in ({notCheckedIn.length})</p>
          <div className="flex flex-wrap gap-2">
            {notCheckedIn.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-surface px-3 py-1 text-xs text-zinc-600">
                <Avatar name={p.name} size="sm" /> {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {modal === 'manual' && <ManualMarkModal training={training} onClose={() => setModal(null)} />}
      {modal === 'offline' && <OfflineModal training={training} onClose={() => setModal(null)} />}
    </Card>
  )
}
