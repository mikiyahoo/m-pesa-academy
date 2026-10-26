import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Mail,
  Plus,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { useAuth } from '../store/Auth'
import { useFeedback } from './Feedback'
import {
  addTeamSchedule,
  getScheduleStatus,
  loadReminderPrefs,
  loadTeamSchedules,
  removeTeamSchedule,
  saveReminderPrefs,
  type ReminderPreferences,
  type TeamSchedule,
} from '../lib/scheduling'
import { cn, formatDate } from '../lib/utils'

export function TrainingScheduleManager() {
  const { trainings } = useStore()
  const { user } = useAuth()
  const { toast } = useFeedback()

  const [schedules, setSchedules] = useState<TeamSchedule[]>(loadTeamSchedules)
  const [prefs, setPrefs] = useState<ReminderPreferences>(loadReminderPrefs)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showPrefsModal, setShowPrefsModal] = useState(false)

  // New schedule form state
  const [selectedTrainingId, setSelectedTrainingId] = useState(trainings[0]?.id || '')
  const [targetGroup, setTargetGroup] = useState('Front-line & Agent Relations Team')
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 10)
    return d.toISOString().split('T')[0]
  })
  const [mandatory, setMandatory] = useState(true)
  const [learnerCount, setLearnerCount] = useState(35)

  const reloadSchedules = () => setSchedules(loadTeamSchedules())

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault()
    const training = trainings.find((t) => t.id === selectedTrainingId)
    if (!training) return

    addTeamSchedule({
      trainingId: training.id,
      trainingTitle: training.title,
      targetGroup: targetGroup.trim(),
      assignedBy: `${user.name} (${user.role})`,
      deadlineDate,
      mandatory,
      remindersEnabled: true,
      learnerCount: Number(learnerCount) || 20,
    })

    setShowScheduleModal(false)
    reloadSchedules()
    toast(
      `Mandatory training schedule created for ${targetGroup}. Push, Email & SMS alerts scheduled.`,
      { tone: 'success' },
    )
  }

  const handleDeleteSchedule = (id: string) => {
    removeTeamSchedule(id)
    reloadSchedules()
    toast('Scheduled deadline removed')
  }

  const handleUpdatePrefs = (updated: Partial<ReminderPreferences>) => {
    const next = { ...prefs, ...updated }
    setPrefs(next)
    saveReminderPrefs(next)
    toast('Reminder notification preferences saved')
  }

  const handleSendTestReminder = (channel: 'Push' | 'Email' | 'SMS') => {
    toast(`🔔 [${channel} Reminder Simulation] Sent: "Reminder: You have mandatory M-PESA training due soon!"`, {
      tone: 'info',
    })
  }

  return (
    <div className="space-y-5">
      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarCheck className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Training Deadlines &amp; Automated Reminders
            </h3>
            <p className="text-xs text-zinc-500">
              Track mandatory team assignments, due dates, and automated push/email/SMS notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrefsModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 transition"
          >
            <Bell className="size-3.5 text-zinc-500" />
            Alert Channels
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs shadow-brand-600/30 hover:bg-brand-700 transition"
          >
            <Plus className="size-3.5" />
            Schedule Team
          </button>
        </div>
      </div>

      {/* Deadlines List */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center">
            <CalendarDays className="mx-auto size-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-700">No scheduled deadlines</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Managers can schedule upcoming mandatory courses for their teams.
            </p>
          </div>
        ) : (
          schedules.map((s) => {
            const statusInfo = getScheduleStatus(s.deadlineDate)
            return (
              <div
                key={s.id}
                className={cn(
                  'flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between',
                  statusInfo.status === 'overdue'
                    ? 'border-brand-200 bg-brand-50/20'
                    : statusInfo.status === 'due-soon'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-zinc-200/80 bg-white shadow-xs',
                )}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.mandatory && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">
                        <AlertTriangle className="size-3" />
                        Mandatory
                      </span>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold',
                        statusInfo.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : statusInfo.status === 'due-soon'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-700',
                      )}
                    >
                      <Clock className="size-3" />
                      {statusInfo.label}
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Users className="size-3.5" />
                      {s.targetGroup} ({s.learnerCount} learners)
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-zinc-900 truncate">{s.trainingTitle}</h4>

                  <p className="text-[11px] text-zinc-500">
                    Assigned by <span className="font-medium text-zinc-700">{s.assignedBy}</span> ·
                    Deadline: {formatDate(s.deadlineDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="inline-flex items-center gap-1 rounded-full bg-mpesa-50 px-2 py-0.5 text-[11px] font-semibold text-mpesa-700 border border-mpesa-200">
                    <CheckCircle2 className="size-3 text-mpesa-600" />
                    Auto-Reminders Active
                  </span>
                  <button
                    onClick={() => handleDeleteSchedule(s.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 transition"
                    title="Remove deadline"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Schedule Team Training Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="size-5 text-brand-600" />
                <h3 className="text-base font-bold text-zinc-900">Schedule Team Training</h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Select Training Course
                </label>
                <select
                  value={selectedTrainingId}
                  onChange={(e) => setSelectedTrainingId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                  Target Team / Branch / Region
                </label>
                <input
                  type="text"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  placeholder="e.g. Addis Ababa Retail Agents, Compliance Officers"
                  required
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                    Completion Deadline
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
                    Learner Count (Est.)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={learnerCount}
                    onChange={(e) => setLearnerCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-900">Mandatory Attendance &amp; Completion</p>
                  <p className="text-[11px] text-zinc-500">Flags course as required on learner dashboards</p>
                </div>
                <input
                  type="checkbox"
                  checked={mandatory}
                  onChange={(e) => setMandatory(e.target.checked)}
                  className="size-4 rounded text-brand-600 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700 transition"
                >
                  Confirm &amp; Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Notification Channels Modal */}
      {showPrefsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-brand-600" />
                <h3 className="text-base font-bold text-zinc-900">
                  Automated Reminder Channels
                </h3>
              </div>
              <button
                onClick={() => setShowPrefsModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-zinc-500">
                Choose how learners and team members receive due-date reminders (3 days before, 24h before, and 1h before session):
              </p>

              {/* Push Notifications */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Bell className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">In-App &amp; Web Push Notifications</p>
                    <p className="text-[11px] text-zinc-500">Instant alerts in browser header &amp; notification tray</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTestReminder('Push')}
                    className="text-[11px] font-semibold text-brand-600 hover:underline"
                  >
                    Test
                  </button>
                  <input
                    type="checkbox"
                    checked={prefs.push}
                    onChange={(e) => handleUpdatePrefs({ push: e.target.checked })}
                    className="size-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Mail className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">Email Reminders</p>
                    <p className="text-[11px] text-zinc-500">{prefs.emailAddress}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTestReminder('Email')}
                    className="text-[11px] font-semibold text-brand-600 hover:underline"
                  >
                    Test
                  </button>
                  <input
                    type="checkbox"
                    checked={prefs.email}
                    onChange={(e) => handleUpdatePrefs({ email: e.target.checked })}
                    className="size-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* SMS Notifications */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-600">
                    <Smartphone className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">SMS Text Alerts</p>
                    <p className="text-[11px] text-zinc-500">{prefs.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendTestReminder('SMS')}
                    className="text-[11px] font-semibold text-brand-600 hover:underline"
                  >
                    Test
                  </button>
                  <input
                    type="checkbox"
                    checked={prefs.sms}
                    onChange={(e) => handleUpdatePrefs({ sms: e.target.checked })}
                    className="size-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end">
                <button
                  onClick={() => setShowPrefsModal(false)}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
