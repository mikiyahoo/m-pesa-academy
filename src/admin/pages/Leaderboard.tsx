import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronUp, ChevronDown, Minus, Filter, Trophy, Star, Flame, Target, Users, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAdmin } from '../store'
import { deriveGamification, buildLeaderboard, type LeaderboardRow } from '../gamification'
import { ALL_BADGES } from '../types'
import { UserAvatar } from '../../components/UserAvatar'

// ─── Podium ───────────────────────────────────────────────────────────────────
function PodiumCard({ row, height, place }: { row: LeaderboardRow; height: string; place: 1 | 2 | 3 }) {
  const colors = {
    1: 'from-yellow-400 to-amber-500 ring-yellow-300',
    2: 'from-zinc-300 to-zinc-400 ring-zinc-200',
    3: 'from-orange-300 to-amber-400 ring-orange-200',
  } as const
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' } as const
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <UserAvatar name={row.person.name} className="size-14 ring-2 ring-white shadow-lg" />
        <span className="absolute -bottom-1 -right-1 text-lg leading-none">{medals[place]}</span>
      </div>
      <div className="text-center max-w-[110px]">
        <p className="text-sm font-semibold text-zinc-900 truncate">{row.person.name}</p>
        <p className="text-[11px] text-zinc-500 truncate">{row.person.department}</p>
      </div>
      <div className={cn('flex flex-col items-center justify-end rounded-t-2xl w-24 bg-gradient-to-b shadow-md ring-2', colors[place])} style={{ height }}>
        <div className="pb-3 text-white text-center">
          <p className="text-lg font-bold leading-none">{row.points.toLocaleString()}</p>
          <p className="text-[10px] opacity-80">pts</p>
        </div>
      </div>
    </div>
  )
}

// ─── Badge Chip ───────────────────────────────────────────────────────────────
function BadgeChip({ badgeId }: { badgeId: string }) {
  const badge = ALL_BADGES.find(b => b.id === badgeId)
  if (!badge) return null
  return (
    <span title={badge.label} className={cn('inline-flex size-6 items-center justify-center rounded-full text-white text-xs shadow-sm', badge.color)}>
      {badge.icon}
    </span>
  )
}

// ─── Trend icon ───────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: LeaderboardRow['trend'] }) {
  if (trend === 'up') return <ChevronUp className="size-4 text-green-500" />
  if (trend === 'down') return <ChevronDown className="size-4 text-red-400" />
  return <Minus className="size-4 text-zinc-400" />
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof Trophy; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-white', color)}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-xl font-bold text-zinc-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AdminLeaderboard() {
  const { data } = useAdmin()
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')

  const gData = useMemo(() => deriveGamification(data), [data])

  const rows = useMemo(
    () => buildLeaderboard(data, gData, groupId || undefined),
    [data, gData, groupId],
  )

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => r.person.name.toLowerCase().includes(q) || r.person.department.toLowerCase().includes(q))
  }, [rows, search])

  const top3 = rows.slice(0, 3)
  const totalParticipants = rows.length
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const totalBadges = rows.reduce((s, r) => s + r.badges.length, 0)
  const totalCompletions = rows.reduce((s, r) => s + r.completedTrainings, 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Trophy className="size-6 text-amber-500" /> Leaderboard
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time learner rankings based on training activity and assessments.</p>
        </div>
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-zinc-400" />
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All groups</option>
            {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users}   label="Participants"   value={totalParticipants}          color="bg-brand-500" />
        <StatCard icon={Star}    label="Total Points"   value={totalPoints.toLocaleString()} color="bg-amber-500" />
        <StatCard icon={Award}   label="Badges Earned"  value={totalBadges}                color="bg-purple-500" />
        <StatCard icon={Target}  label="Completions"    value={totalCompletions}           color="bg-green-500" />
      </div>

      {/* Podium */}
      {top3.length >= 3 && (
        <div className="rounded-3xl border border-zinc-100 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">🏆 Top Performers</p>
          <div className="flex items-end justify-center gap-4">
            {top3[1] && <PodiumCard row={top3[1]} height="80px"  place={2} />}
            {top3[0] && <PodiumCard row={top3[0]} height="110px" place={1} />}
            {top3[2] && <PodiumCard row={top3[2]} height="60px"  place={3} />}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or department…"
          className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-4 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Rankings table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 hidden sm:table-cell">Badges</th>
                <th className="px-4 py-3 hidden md:table-cell text-right">Trainings</th>
                <th className="px-4 py-3 hidden md:table-cell text-right">Assessments</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((row) => {
                const isTop3 = row.rank <= 3
                return (
                  <tr
                    key={row.person.id}
                    className={cn(
                      'transition-colors hover:bg-zinc-50',
                      isTop3 && 'bg-amber-50/40',
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold',
                        row.rank === 1 ? 'bg-yellow-400 text-white' :
                        row.rank === 2 ? 'bg-zinc-300 text-white' :
                        row.rank === 3 ? 'bg-orange-300 text-white' :
                        'bg-zinc-100 text-zinc-500',
                      )}>{row.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${row.person.id}`} className="flex items-center gap-3 group">
                        <UserAvatar name={row.person.name} className="size-8 ring-1 ring-zinc-200" />
                        <span>
                          <span className="block font-medium text-zinc-900 group-hover:text-brand-600">{row.person.name}</span>
                          <span className="block text-[11px] text-zinc-400">{row.person.department}{row.person.region ? ` · ${row.person.region}` : ''}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-900">
                        <Flame className="size-3.5 text-orange-400" />
                        {row.points.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {row.badges.slice(0, 5).map(b => <BadgeChip key={b.badgeId} badgeId={b.badgeId} />)}
                        {row.badges.length > 5 && (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">+{row.badges.length - 5}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-right font-medium text-zinc-700">{row.completedTrainings}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-right font-medium text-zinc-700">{row.assessmentsPassed}</td>
                    <td className="px-4 py-3">
                      <TrendIcon trend={row.trend} />
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-zinc-400">No learners found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badge legend */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-4">
          <TrendingUp className="size-4 text-brand-500" /> Achievement Badges
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_BADGES.map(badge => (
            <div key={badge.id} className="flex items-start gap-2.5 rounded-xl border border-zinc-100 p-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl text-lg', badge.color)}>
                {badge.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-900 leading-tight">{badge.label}</p>
                <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{badge.description}</p>
                <p className="text-[10px] font-bold text-amber-600 mt-1">+{badge.points} pts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
