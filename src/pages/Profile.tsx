import { Award, BellRing, BookOpen, Briefcase, LogOut, Mail, Phone, Star, Users } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatStrip } from '../components/CalendarParts'
import { SegmentTabs } from '../components/SegmentTabs'
import { JourneyTimeline } from '../components/JourneyTimeline'
import { UserAvatar } from '../components/UserAvatar'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import { loadNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from '../lib/notificationPrefs'
import { computeMetrics } from '../lib/stats'
import { certificateChecks, cn } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { useStore } from '../store/AppStore'

type ProfileTab = 'journeys' | 'account'

/** Learner profile: account details from the directory, learning summary and notification preferences. */
export function Profile() {
  const { user, logout } = useAuth()
  const { trainings, progress } = useStore()
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotificationPrefs)
  // Account opens first; ?tab=journeys opens Learning journeys.
  const [params, setParams] = useSearchParams()
  const tab: ProfileTab = params.get('tab') === 'journeys' ? 'journeys' : 'account'
  const pickTab = (t: ProfileTab) => setParams(t === 'journeys' ? { tab: 'journeys' } : {}, { replace: true })
  const metrics = computeMetrics(trainings, progress)
  const certificates = trainings.filter((t) => certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES).eligible).length

  const toggle = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    saveNotificationPrefs(next)
  }

  const details = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone },
    { icon: Briefcase, label: 'Role', value: user.role },
    { icon: Users, label: 'Group', value: 'Call Center — ISON' },
  ]
  const prefRows: { key: keyof NotificationPrefs; title: string; text: string }[] = [
    { key: 'reminders', title: 'Session reminders', text: 'A reminder the day before and an hour before each session.' },
    { key: 'certificates', title: 'Certificates', text: 'When a new certificate is issued to you.' },
    { key: 'feedback', title: 'Feedback requests', text: 'When a finished training is waiting for your feedback.' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Profile</h1>

      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
        <UserAvatar name={user.name} className="size-20 ring-4 ring-brand-50" />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-zinc-900">{user.name}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{user.role}</p>
        </div>
        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </section>

      <StatStrip
        items={[
          { icon: BookOpen, label: 'Completed trainings', value: `${metrics.completed}/${metrics.total}`, tone: 'red' },
          { icon: Award, label: 'Certificates', value: certificates, tone: 'green' },
          { icon: Star, label: 'Average score', value: `${Math.round(metrics.averageScore)}%`, tone: 'amber' },
        ]}
      />

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-2.5">
        <SegmentTabs<ProfileTab>
          label="Profile sections"
          items={[
            { value: 'account', label: 'Account' },
            { value: 'journeys', label: 'Learning journeys' },
          ]}
          value={tab}
          onChange={pickTab}
        />
      </div>

      {tab === 'journeys' ? (
        <JourneyTimeline />
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-zinc-900">Account details</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Managed by your administrator — contact Learning & Development to change them.</p>
          <dl className="mt-4 divide-y divide-zinc-100">
            {details.map((d) => (
              <div key={d.label} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                  <d.icon className="size-4" />
                </span>
                <dt className="w-16 shrink-0 text-xs text-zinc-500">{d.label}</dt>
                <dd className="min-w-0 truncate text-sm font-medium text-zinc-900">{d.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <BellRing className="size-4 text-brand-600" /> Notifications
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">Choose what shows up in your notification bell.</p>
          <ul className="mt-4 divide-y divide-zinc-100">
            {prefRows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">{r.title}</span>
                  <span className="block text-xs text-zinc-500">{r.text}</span>
                </span>
                <button
                  role="switch"
                  aria-checked={prefs[r.key]}
                  aria-label={r.title}
                  onClick={() => toggle(r.key)}
                  className={cn('relative h-6 w-11 shrink-0 rounded-full transition', prefs[r.key] ? 'bg-brand-600' : 'bg-zinc-300')}
                >
                  <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', prefs[r.key] ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      )}
    </div>
  )
}

