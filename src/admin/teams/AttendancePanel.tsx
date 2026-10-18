import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, Link2, Loader2, RefreshCw, Settings2, UserX, Video, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useFeedback } from '../../components/Feedback'
import { cn } from '../../lib/utils'
import { useAdmin } from '../store'
import type { AdminTraining, AttendanceRules } from '../types'
import { Avatar, Button, Card, downloadCsv, Empty, Field, Input, Modal } from '../ui'
import { attendanceRows, type AttendanceStatus, formatClock, formatDuration, getAttendanceProvider, isDemoMeeting, sessionWindow } from './attendance'

export const attendanceStyle: Record<AttendanceStatus, { icon: typeof CheckCircle2; cls: string; dot: string }> = {
  Present: { icon: CheckCircle2, cls: 'bg-mpesa-500/10 text-mpesa-700 ring-mpesa-500/20 dark:text-mpesa-500', dot: 'bg-mpesa-500' },
  Late: { icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400', dot: 'bg-amber-500' },
  Incomplete: { icon: XCircle, cls: 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:text-zinc-300', dot: 'bg-zinc-400' },
  Absent: { icon: UserX, cls: 'bg-brand-50 text-brand-700 ring-brand-200 dark:text-brand-500', dot: 'bg-brand-600' },
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const s = attendanceStyle[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', s.cls)}>
      <s.icon className="size-3.5" /> {status}
    </span>
  )
}

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useAdmin()
  const [r, setR] = useState<AttendanceRules>(data.attendanceRules)
  const [alerts, setAlerts] = useState(data.alertRules)
  const valid = r.absentBelowPct >= 0 && r.absentBelowPct < r.presentPct && r.presentPct <= 100 && r.lateMinutes >= 0 && alerts.feedbackBelow >= 1 && alerts.feedbackBelow <= 5 && alerts.attendanceBelow >= 0 && alerts.attendanceBelow <= 100
  const num = (k: keyof AttendanceRules) => (e: React.ChangeEvent<HTMLInputElement>) => setR({ ...r, [k]: Number(e.target.value) })

  return (
    <Modal
      open
      onClose={onClose}
      title="Attendance rules"
      description="Applied to every Teams training. Changing them re-evaluates existing reports."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              const was = data.attendanceRules
              const wasAlerts = data.alertRules
              update((d) => ({ ...d, attendanceRules: r, alertRules: alerts }), {
                action: 'Updated attendance rules',
                target: `Present ≥ ${r.presentPct}%, late > ${r.lateMinutes} min, absent < ${r.absentBelowPct}%`,
                changes: [
                  { field: 'Present at %', from: String(was.presentPct), to: String(r.presentPct) },
                  { field: 'Late after min', from: String(was.lateMinutes), to: String(r.lateMinutes) },
                  { field: 'Absent below %', from: String(was.absentBelowPct), to: String(r.absentBelowPct) },
                  { field: 'Feedback alert below', from: String(wasAlerts.feedbackBelow), to: String(alerts.feedbackBelow) },
                  { field: 'Attendance alert below %', from: String(wasAlerts.attendanceBelow), to: String(alerts.attendanceBelow) },
                ],
              })
              onClose()
            }}
          >
            Save rules
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Present at (%)" hint="of the session">
          <Input type="number" min={1} max={100} value={r.presentPct} onChange={num('presentPct')} />
        </Field>
        <Field label="Late after (min)" hint="from the start time">
          <Input type="number" min={0} value={r.lateMinutes} onChange={num('lateMinutes')} />
        </Field>
        <Field label="Absent below (%)" hint="of the session">
          <Input type="number" min={0} max={99} value={r.absentBelowPct} onChange={num('absentBelowPct')} />
        </Field>
      </div>
      <p className="mt-5 mb-2 text-sm font-semibold text-zinc-900">Alerts to the training manager</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Feedback below (1–5)" hint="any single response (F04)">
          <Input type="number" min={1} max={5} step={0.1} value={alerts.feedbackBelow} onChange={(e) => setAlerts({ ...alerts, feedbackBelow: Number(e.target.value) })} />
        </Field>
        <Field label="Group attendance below (%)" hint="per team, per session (T06)">
          <Input type="number" min={0} max={100} value={alerts.attendanceBelow} onChange={(e) => setAlerts({ ...alerts, attendanceBelow: Number(e.target.value) })} />
        </Field>
      </div>
      {!valid && <p className="mt-3 text-xs text-brand-600">“Absent below” must be lower than “Present at”, percentages must be 0–100 and the feedback threshold 1–5.</p>}
      <ul className="mt-5 space-y-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
        <li className="flex items-center gap-2">
          <AttendanceBadge status="Present" /> attended ≥ {r.presentPct}% and joined on time
        </li>
        <li className="flex items-center gap-2">
          <AttendanceBadge status="Late" /> joined more than {r.lateMinutes} min after the start
        </li>
        <li className="flex items-center gap-2">
          <AttendanceBadge status="Incomplete" /> attended {r.absentBelowPct}–{Math.max(r.absentBelowPct, r.presentPct - 1)}%
        </li>
        <li className="flex items-center gap-2">
          <AttendanceBadge status="Absent" /> never joined, or attended &lt; {r.absentBelowPct}%
        </li>
      </ul>
    </Modal>
  )
}

function MeetingModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { update } = useAdmin()
  const [joinUrl, setJoinUrl] = useState(training.teamsMeeting?.joinUrl ?? '')
  const [meetingId, setMeetingId] = useState(training.teamsMeeting?.meetingId ?? '')
  const urlValid = /^https:\/\/teams\.(microsoft|live)\.com\//.test(joinUrl.trim())

  return (
    <Modal
      open
      onClose={onClose}
      title={training.teamsMeeting ? 'Edit Teams meeting' : 'Link a Teams meeting'}
      description="Participants join from the learning platform; attendance is pulled from this meeting."
      footer={
        <>
          {training.teamsMeeting && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, teamsMeeting: undefined } : t)) }), { action: 'Unlinked Teams meeting', target: training.name })
                onClose()
              }}
            >
              Unlink
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!urlValid || !meetingId.trim()}
            onClick={() => {
              update(
                (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, teamsMeeting: { joinUrl: joinUrl.trim(), meetingId: meetingId.trim() } } : t)) }),
                { action: 'Linked Teams meeting', target: training.name },
              )
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Join link">
          <Input value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://teams.microsoft.com/l/meetup-join/…" autoFocus />
          {joinUrl && !urlValid && <span className="mt-1 block text-xs text-brand-600">Paste a Microsoft Teams meeting link.</span>}
        </Field>
        <Field label="Online meeting ID" hint="From Graph: GET /me/onlineMeetings?$filter=JoinWebUrl eq '<join link>'">
          <Input value={meetingId} onChange={(e) => setMeetingId(e.target.value)} placeholder="MSo1N2Y5ZGFjYy03MWJm…" />
        </Field>
      </div>
    </Modal>
  )
}

type Filter = 'All' | AttendanceStatus

export function AttendancePanel({ training }: { training: AdminTraining }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<Filter>('All')
  const [modal, setModal] = useState<null | 'rules' | 'meeting'>(null)

  const rules = data.attendanceRules
  const rows = attendanceRows(training, data.people, rules)
  const { start } = sessionWindow(training)
  const started = Date.now() >= start.getTime()
  const synced = !!training.attendance
  const counts = (['Present', 'Late', 'Incomplete', 'Absent'] as AttendanceStatus[]).map((s) => ({ s, n: rows.filter((r) => r.status === s).length }))
  const attended = rows.filter((r) => r.status !== 'Absent').length
  const visible = rows.filter((r) => filter === 'All' || r.status === filter).sort((a, b) => (a.join?.getTime() ?? Infinity) - (b.join?.getTime() ?? Infinity))

  const sync = async () => {
    setSyncing(true)
    try {
      const provider = getAttendanceProvider()
      const records = await provider.fetchAttendance(training, data.people)
      update(
        (d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, attendance: { syncedAt: new Date().toISOString(), source: provider.source, records } } : t)) }),
        { action: `Synced Teams attendance (${records.length} attendees)`, target: training.name, silent: true },
      )
      toast(`Attendance synced from Teams — ${records.length} attendee${records.length === 1 ? '' : 's'}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reach Microsoft Teams', { tone: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(training.teamsMeeting!.joinUrl)
      toast('Join link copied')
    } catch {
      toast('Could not copy the link', { tone: 'error' })
    }
  }

  const exportCsv = () =>
    downloadCsv(
      `${training.name.replace(/[^\w-]+/g, '_')}_attendance.csv`,
      ['Participant', 'Email', 'Join', 'Leave', 'Duration', 'Attended %', 'Attendance'],
      rows.map((r) => [r.person.name, r.person.email, formatClock(r.join), formatClock(r.leave), r.seconds ? formatDuration(r.seconds) : '', Math.round(r.pct), r.status]),
    )

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-zinc-900">
            Attendance
            <span className="inline-flex items-center gap-1 rounded-full bg-[#5b5fc7]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#5b5fc7] dark:text-[#9ea2ff]">
              <Video className="size-3" /> Microsoft Teams
            </span>
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {synced
              ? `Synced ${ago(training.attendance!.syncedAt)} · ${training.attendance!.source === 'graph' ? 'Microsoft Graph' : 'Simulated data (demo)'}`
              : 'Attendance is pulled from the Teams meeting once the session starts.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setModal('rules')}>
            <Settings2 className="size-3.5" /> Rules
          </Button>
          {synced && (
            <Button size="sm" onClick={exportCsv}>
              <Download className="size-3.5" /> Export
            </Button>
          )}
          {training.teamsMeeting && (
            <Button size="sm" variant="primary" onClick={sync} disabled={syncing || !started} title={started ? undefined : 'Available once the session starts'}>
              {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {syncing ? 'Syncing…' : synced ? 'Re-sync' : 'Sync from Teams'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-5 py-3 text-sm">
        {training.teamsMeeting ? (
          <>
            <Link2 className="size-4 shrink-0 text-zinc-500" />
            <span className="min-w-0 flex-1 truncate text-zinc-600">{training.teamsMeeting.joinUrl}</span>
            <Button size="sm" variant="ghost" onClick={copyLink}>
              <Copy className="size-3.5" /> Copy
            </Button>
            {!isDemoMeeting(training.teamsMeeting.joinUrl) && (
              <a href={training.teamsMeeting.joinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900">
                <ExternalLink className="size-3.5" /> Open
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={() => setModal('meeting')}>
              Edit
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-zinc-500">No Teams meeting linked — participants can’t join online.</span>
            <Button size="sm" onClick={() => setModal('meeting')}>
              <Video className="size-3.5" /> Link Teams meeting
            </Button>
          </>
        )}
      </div>

      {synced ? (
        <>
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
            <button
              onClick={() => setFilter('All')}
              className={cn('rounded-xl border p-3 text-left transition', filter === 'All' ? 'border-zinc-900 dark:border-zinc-500' : 'border-zinc-200 hover:bg-zinc-50')}
            >
              <p className="text-xs text-zinc-500">Attendance rate</p>
              <p className="mt-0.5 text-xl font-bold text-zinc-900">{rows.length ? Math.round((attended / rows.length) * 100) : 0}%</p>
            </button>
            {counts.map(({ s, n }) => (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? 'All' : s)}
                className={cn('rounded-xl border p-3 text-left transition', filter === s ? 'border-zinc-900 dark:border-zinc-500' : 'border-zinc-200 hover:bg-zinc-50')}
                aria-pressed={filter === s}
              >
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className={cn('size-2 rounded-full', attendanceStyle[s].dot)} /> {s}
                </p>
                <p className="mt-0.5 text-xl font-bold text-zinc-900">{n}</p>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-y border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  {['Participant', 'Join', 'Leave', 'Duration', 'Attendance'].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visible.map((r) => (
                  <tr key={r.person.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.person.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium text-zinc-900">{r.person.name}</span>
                          <span className="block truncate text-xs text-zinc-500">{r.person.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-700">{formatClock(r.join)}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-700">{formatClock(r.leave)}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-700">
                      {r.seconds ? formatDuration(r.seconds) : '—'}
                      {r.seconds > 0 && <span className="ml-1.5 text-xs text-zinc-400">{Math.round(r.pct)}%</span>}
                      {r.rejoins > 0 && <span className="block text-[11px] text-zinc-500">rejoined {r.rejoins}×</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <AttendanceBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-zinc-500">
                      No one is {filter.toLowerCase()}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Empty
          icon={Video}
          title={training.teamsMeeting ? (started ? 'Not synced yet' : 'Session hasn’t started') : 'No Teams meeting'}
          text={
            training.teamsMeeting
              ? started
                ? 'Pull join and leave times from Teams to build the attendance report.'
                : `Sync becomes available at ${formatClock(start)} on the training day.`
              : 'Link a Teams meeting to track attendance automatically.'
          }
          action={
            training.teamsMeeting &&
            started && (
              <Button variant="primary" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} {syncing ? 'Syncing…' : 'Sync from Teams'}
              </Button>
            )
          }
        />
      )}

      {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
      {modal === 'meeting' && <MeetingModal training={training} onClose={() => setModal(null)} />}
    </Card>
  )
}
