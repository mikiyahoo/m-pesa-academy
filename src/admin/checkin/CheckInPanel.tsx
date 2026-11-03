import QRCode from 'qrcode'
import { AlertCircle, Check, ClipboardCheck, Download, Link2, QrCode, Send, ShieldCheck, Upload, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFeedback } from '../../components/Feedback'
import { localISO } from '../../lib/utils'
import { useAdmin } from '../store'
import { AttendanceRoster, AttendanceTotals, AttendanceUpload } from './AttendanceRoster'
import { addCheckin, checkinLink, fixedToken, rotatingToken, statusFor, tokenCountdown } from './checkin'
import { Avatar, Badge, Button, Card, downloadCsv, Empty } from '../ui'
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

/** Full-screen QR for a projector or screen at the door; Esc or the close button leaves it. */
function BigQr({ link, title, rotating, seconds, checkedIn, total, onClose }: { link: string; title: string; rotating: boolean; seconds: number; checkedIn: number; total: number; onClose: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(link, { width: 1000, margin: 1, color: { dark: '#18181b', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [link])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal aria-label="Check-in QR code" className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-white p-6 text-center">
      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 grid size-11 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
        <X className="size-6" />
      </button>
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Scan to check in</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{title}</h2>
      </div>
      {src ? (
        <img src={src} alt="Check-in QR code" className="aspect-square w-[min(70vh,85vw)] rounded-3xl border border-zinc-200 p-3 shadow-sm" />
      ) : (
        <span className="grid aspect-square w-[min(70vh,85vw)] place-items-center rounded-3xl bg-zinc-100 text-zinc-400">
          <QrCode className="size-20" />
        </span>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-600">
        <span className="font-semibold text-zinc-900 tabular-nums">
          {checkedIn} / {total} checked in
        </span>
        {rotating && <span className="tabular-nums">Code changes in {seconds}s</span>}
        <span className="max-w-[90vw] truncate text-xs text-zinc-400">{link}</span>
      </div>
    </div>,
    document.body,
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

  const rotating = session?.qr === 'rotating'
  // Tick while a session is open so a changing QR token rotates every 10 s.
  useEffect(() => {
    if (!open || !rotating) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open, rotating])

  const token = session ? (rotating ? rotatingToken(session.token, now) : fixedToken(session.token)) : ''
  const link = token ? checkinLink(training.id, token) : ''
  const [qr, setQr] = useState('')
  const [bigQr, setBigQr] = useState(false)
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

  const setQrMode = (qr: 'fixed' | 'rotating') => {
    if (!session) return
    update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, checkinSession: { ...session, qr } } : t)) }), {
      action: qr === 'fixed' ? 'Switched to one QR code' : 'Switched to a changing QR code',
      target: training.name,
      silent: true,
    })
  }

  // A large copy of the fixed code to print or put on a slide.
  const downloadQr = async () => {
    try {
      const url = await QRCode.toDataURL(link, { width: 1024, margin: 2, color: { dark: '#18181b', light: '#ffffff' } })
      const a = document.createElement('a')
      a.href = url
      a.download = `check-in-${training.name.replace(/[^\w]+/g, '-').toLowerCase()}.png`
      a.click()
    } catch {
      toast('Couldn’t create the QR image', { tone: 'error' })
    }
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
          <Button size="sm" onClick={() => setModal('manual')}>
            <ClipboardCheck className="size-3.5" /> Mark attendance
          </Button>
          <Button size="sm" onClick={() => setModal('offline')}>
            <Upload className="size-3.5" /> Upload attendance
          </Button>
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
              <button type="button" onClick={() => setBigQr(true)} title="Show full screen" aria-label="Show the QR code full screen" className="group relative shrink-0 rounded-xl">
                <img src={qr} alt="Check-in QR code" className="size-[110px] rounded-xl transition group-hover:opacity-80" />
                <span className="absolute inset-0 grid place-items-center rounded-xl opacity-0 transition group-hover:opacity-100">
                  <span className="rounded-full bg-charcoal/85 px-2 py-1 text-[11px] font-semibold text-white">Full screen</span>
                </span>
              </button>
            ) : (
              <span className="grid size-[110px] place-items-center rounded-xl bg-zinc-100 text-zinc-400">
                <QrCode className="size-10" />
              </span>
            )}
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                {rotating && <CountdownRing seconds={tokenCountdown(now)} total={10} />} {rotating ? 'Changing code' : 'Session QR code'}
              </p>
              <p className="mt-1 max-w-[240px] truncate text-xs text-zinc-500" title={link}>
                {link}
              </p>
              <p className="mt-0.5 max-w-[240px] text-[11px] text-zinc-400">
                {rotating ? 'Changes every 10 s — screenshots expire.' : 'One code for the whole session. Works only while attendance is open; each person checks in once.'}
              </p>
              <div className="mt-2 inline-flex rounded-xl border border-zinc-200 p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="QR code type">
                {(
                  [
                    ['fixed', 'One QR'],
                    ['rotating', 'Changing'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={(rotating ? 'rotating' : 'fixed') === v}
                    onClick={() => setQrMode(v)}
                    className={(rotating ? 'rotating' : 'fixed') === v ? 'rounded-lg bg-charcoal px-2.5 py-1 text-white' : 'rounded-lg px-2.5 py-1 text-zinc-600 hover:bg-zinc-100'}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={copy}>
              <Link2 className="size-3.5" /> Copy unique link
            </Button>
            {!rotating && (
              <Button size="sm" onClick={downloadQr}>
                <Download className="size-3.5" /> Download QR
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={simulate}>
              <UserPlus className="size-3.5" /> Simulate a scan
            </Button>
          </div>
        </div>
      )}

      <div className="border-b border-zinc-200 p-5 pb-0">
        <AttendanceTotals training={training} peopleCount={training.participantIds.length} />
      </div>
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

      {bigQr && open && link && (
        <BigQr link={link} title={training.name} rotating={rotating} seconds={tokenCountdown(now)} checkedIn={checkins.length} total={training.participantIds.length} onClose={() => setBigQr(false)} />
      )}
      {modal === 'manual' && <AttendanceRoster training={training} onClose={() => setModal(null)} onCopyLink={copy} onExport={exportCsv} />}
      {modal === 'offline' && <AttendanceUpload training={training} onClose={() => setModal(null)} />}
    </Card>
  )
}
