import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Minus, Star, Target, Trophy, Users } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAdmin } from '../store'
import { deriveGamification, buildLeaderboard, type LeaderboardRow } from '../gamification'
import { ALL_BADGES } from '../types'
import { UserAvatar } from '../../components/UserAvatar'
import { Button, Empty, PageHeader, SearchInput, Select, StatCard, Table } from '../ui'

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

// ─── Main page ────────────────────────────────────────────────────────────────
export function AdminLeaderboard() {
  const { data } = useAdmin()
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const tableRef = useRef<HTMLDivElement>(null)
  const pagerRef = useRef<HTMLDivElement>(null)

  const gData = useMemo(() => deriveGamification(data), [data])
  const rows = useMemo(() => buildLeaderboard(data, gData, groupId || undefined), [data, gData, groupId])
  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => r.person.name.toLowerCase().includes(q) || r.person.department.toLowerCase().includes(q))
  }, [rows, search])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const pageRows = filtered.slice(current * pageSize, (current + 1) * pageSize)


  const top3 = rows.slice(0, 3)
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const totalBadges = rows.reduce((s, r) => s + r.badges.length, 0)
  const totalCompletions = rows.reduce((s, r) => s + r.completedTrainings, 0)

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Real-time learner rankings based on training activity and assessments."
        actions={
          <>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(0)
              }}
              placeholder="Search by name or department…"
              className="w-full sm:w-72"
            />
            <div className="w-52">
              <Select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value)
                  setPage(0)
                }}
                aria-label="Group"
              >
                <option value="">All groups</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Participants" value={rows.length} tone="red" />
        <StatCard icon={Star} label="Total points" value={totalPoints.toLocaleString()} tone="amber" />
        <StatCard icon={Award} label="Badges earned" value={totalBadges} tone="zinc" />
        <StatCard icon={Target} label="Completions" value={totalCompletions} tone="green" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Rankings */}
        <div className="min-w-0">
          {filtered.length ? (
            <div ref={tableRef}>
              <Table head={['#', 'Learner', 'Points', 'Badges', 'Trainings', 'Assessments', 'Trend']} minWidth={760}>
                {pageRows.map((row) => (
                  <tr key={row.person.id} className="transition hover:bg-zinc-50/80">
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex size-7 items-center justify-center rounded-full text-xs font-bold',
                          row.rank === 1 ? 'bg-amber-400 text-white' : row.rank === 2 ? 'bg-zinc-300 text-white' : row.rank === 3 ? 'bg-orange-300 text-white' : 'bg-zinc-100 text-zinc-600',
                        )}
                      >
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/users/${row.person.id}`} className="group flex min-w-0 items-center gap-3">
                        <UserAvatar name={row.person.name} className="size-8 ring-1 ring-zinc-200" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900 group-hover:text-brand-600">{row.person.name}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {row.person.department}
                            {row.person.region ? ` · ${row.person.region}` : ''}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 font-bold text-zinc-900 tabular-nums">
                        <Flame className="size-3.5 text-orange-400" />
                        {row.points.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.badges.slice(0, 5).map((b) => (
                          <BadgeChip key={b.badgeId} badgeId={b.badgeId} />
                        ))}
                        {row.badges.length > 5 && <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600">+{row.badges.length - 5}</span>}
                        {!row.badges.length && <span className="text-xs text-zinc-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-700 tabular-nums">{row.completedTrainings}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-700 tabular-nums">{row.assessmentsPassed}</td>
                    <td className="px-4 py-2.5">
                      <TrendIcon trend={row.trend} />
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/80 bg-surface">
              <Empty icon={Trophy} title="No learners found" text="Try another name or group." />
            </div>
          )}

          {filtered.length > 0 && (
            <div ref={pagerRef} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                Showing {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length} learners
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2">
                  Rows per page
                  <div className="w-32">
                    <Select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setPage(0)
                      }}
                      aria-label="Rows per page"
                      className="py-1.5 text-xs"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </Select>
                  </div>
                </label>
                <span className="px-1">
                  Page {current + 1} of {pages}
                </span>
                <Button size="sm" aria-label="First page" disabled={current === 0} onClick={() => setPage(0)}>
                  <ChevronLeft className="size-3.5" />
                  <ChevronLeft className="-ml-2 size-3.5" />
                </Button>
                <Button size="sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button size="sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button size="sm" aria-label="Last page" disabled={current >= pages - 1} onClick={() => setPage(pages - 1)}>
                  <ChevronRight className="size-3.5" />
                  <ChevronRight className="-ml-2 size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Top performers and badges beside the table */}
        <div className="space-y-5">
          {top3.length >= 3 && (
            <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5">
              <h2 className="text-base font-bold text-zinc-900">Top performers</h2>
              <div className="mt-5 flex items-end justify-center gap-3">
                <PodiumCard row={top3[1]} height="72px" place={2} />
                <PodiumCard row={top3[0]} height="100px" place={1} />
                <PodiumCard row={top3[2]} height="56px" place={3} />
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5">
            <h2 className="text-base font-bold text-zinc-900">Achievement badges</h2>
            <ul className="mt-3 space-y-2">
              {ALL_BADGES.map((badge) => (
                <li key={badge.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-2.5">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl text-lg', badge.color)}>{badge.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{badge.label}</span>
                    <span className="block truncate text-xs text-zinc-500" title={badge.description}>
                      {badge.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-amber-600">+{badge.points}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
