import { Award, BellRing, BookOpen, Briefcase, Check, Flame, Lock, LogOut, Mail, Phone, Sparkles, Star, Trophy, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { loadAdminData } from '../admin/storage'
import { deriveGamification } from '../admin/gamification'
import { ALL_BADGES } from '../admin/types'
import { DEMO_LEARNER_ID } from '../lib/learner'
import { shortDate } from '../admin/helpers'

type ProfileTab = 'journeys' | 'account' | 'achievements'

/** Learner profile: account details from the directory, learning summary and notification preferences. */
export function Profile() {
  const { user, logout } = useAuth()
  const { trainings, progress } = useStore()
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotificationPrefs)
  // Account opens first; ?tab=journeys opens Learning journeys.
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: ProfileTab = tabParam === 'journeys' || tabParam === 'achievements' ? tabParam : 'account'
  const pickTab = (t: ProfileTab) => setParams(t === 'account' ? {} : { tab: t }, { replace: true })
  const metrics = computeMetrics(trainings, progress)
  const certificates = trainings.filter((t) => certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES).eligible).length

  const adminData = useMemo(() => loadAdminData(), [])
  const person = useMemo(() => {
    return (
      adminData.people.find((p) => p.email.toLowerCase() === user.email.toLowerCase()) ||
      adminData.people.find((p) => p.id === DEMO_LEARNER_ID) ||
      adminData.people[0]
    )
  }, [adminData, user.email])
  const gamification = useMemo(() => deriveGamification(adminData), [adminData])
  const userGame = person ? gamification.people[person.id] : undefined
  const userPoints = userGame?.points ?? 0
  const earnedBadges = userGame?.badges ?? []
  const pointEvents = userGame?.events ?? []

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
          { icon: Trophy, label: 'Gamification points', value: `${userPoints.toLocaleString()} pts`, tone: 'amber' },
          { icon: Star, label: 'Average score', value: `${Math.round(metrics.averageScore)}%`, tone: 'blue' },
        ]}
      />

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-2.5">
        <SegmentTabs<ProfileTab>
          label="Profile sections"
          items={[
            { value: 'account', label: 'Account' },
            { value: 'journeys', label: 'Learning journeys' },
            { value: 'achievements', label: 'Achievements & Badges', badge: `${earnedBadges.length} earned` },
          ]}
          value={tab}
          onChange={pickTab}
        />
      </div>

      {tab === 'journeys' && <JourneyTimeline />}

      {tab === 'achievements' && (
        <div className="space-y-6">
          {/* Achievement Hero */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-orange-50/30 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                <Trophy className="size-4 text-amber-600" /> Total Points
              </div>
              <p className="mt-2 text-3xl font-black text-amber-950">{userPoints.toLocaleString()}</p>
              <p className="mt-1 text-xs text-amber-800/80">Keep learning to climb the ranks!</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-teal-50/30 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <Award className="size-4 text-emerald-600" /> Badges Unlocked
              </div>
              <p className="mt-2 text-3xl font-black text-emerald-950">
                {earnedBadges.length} <span className="text-base font-normal text-zinc-500">/ {ALL_BADGES.length}</span>
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">{Math.round((earnedBadges.length / ALL_BADGES.length) * 100)}% badges collected</p>
            </div>
            <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-500/10 via-brand-50/50 to-sky-50/30 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-800">
                <Flame className="size-4 text-brand-600" /> Recent Activity
              </div>
              <p className="mt-2 text-3xl font-black text-brand-950">{pointEvents.length}</p>
              <p className="mt-1 text-xs text-brand-800/80">Recognized learning events</p>
            </div>
          </div>

          {/* Badges Grid */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <Sparkles className="size-5 text-amber-500" /> Badges & Achievements
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Earn badges by completing courses, passing quizzes with top scores, and attending group sessions.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_BADGES.map((b) => {
                const earned = earnedBadges.find((eb) => eb.badgeId === b.id)
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'relative flex items-start gap-3 rounded-xl border p-4 transition-all',
                      earned
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-amber-50/20 shadow-xs ring-1 ring-emerald-500/10'
                        : 'border-zinc-200/70 bg-zinc-50/60 opacity-60'
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-xl text-2xl shadow-xs',
                        earned ? b.color + ' text-white ring-2 ring-white' : 'bg-zinc-200 text-zinc-400'
                      )}
                    >
                      {earned ? b.icon : <Lock className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-sm font-bold truncate', earned ? 'text-zinc-900' : 'text-zinc-500')}>
                          {b.label}
                        </p>
                        <span className="text-[11px] font-bold text-amber-600 shrink-0">+{b.points} pts</span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 leading-snug line-clamp-2">{b.description}</p>
                      {earned ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <Check className="size-3" /> Unlocked {shortDate(earned.earnedAt)}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-zinc-400">Locked</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Points History */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <Flame className="size-4 text-orange-500" /> Points History
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Every activity that contributed to your score.</p>

            {pointEvents.length === 0 ? (
              <p className="mt-4 text-xs text-zinc-400">No activity logged yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-zinc-100 max-h-80 overflow-y-auto pr-1">
                {pointEvents
                  .slice()
                  .reverse()
                  .map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between py-2.5 first:pt-0">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-medium text-zinc-800">{ev.label}</p>
                        <p className="text-xs text-zinc-400">{shortDate(ev.at)}</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200 shrink-0">
                        +{ev.points} pts
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'account' && (
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

