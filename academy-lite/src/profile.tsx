import { Award, Bookmark, Flame, Grid3x3, Heart, Menu, RotateCcw, Share2, UserPen } from 'lucide-react'
import { useState } from 'react'
import { COURSES, ME, findItem, trainerOf } from './data'
import { ItemThumb } from './sheets'
import { useLite } from './store'
import { Avatar, Sheet, cn, useToast } from './ui'

type Tab = 'courses' | 'saved' | 'certificates' | 'liked'

/** Your learning at a glance: streak and level, courses in progress, saved posts and certificates. */
export function Profile({ onOpenCourse, onOpenItem }: { onOpenCourse: (courseId: string) => void; onOpenItem: (itemId: string) => void }) {
  const { s, progress, reset } = useLite()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('courses')
  const [menu, setMenu] = useState(false)
  const level = Math.floor(s.xp / 100) + 1
  const toNext = 100 - (s.xp % 100)
  const mine = COURSES.filter((c) => s.enrolled.includes(c.id))
  const items = (ids: string[]) => ids.map(findItem).filter((x): x is NonNullable<ReturnType<typeof findItem>> => !!x)

  const tabs: { id: Tab; icon: typeof Grid3x3; label: string }[] = [
    { id: 'courses', icon: Grid3x3, label: 'My courses' },
    { id: 'saved', icon: Bookmark, label: 'Saved' },
    { id: 'certificates', icon: Award, label: 'Certificates' },
    { id: 'liked', icon: Heart, label: 'Liked' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-white text-zinc-900">
      {/* Cover + avatar */}
      <div className="relative h-36 bg-gradient-to-br from-[#d03c3b] via-[#b8302f] to-[#39b54a]">
        <img src="/M-PESA Pattern.svg" alt="" className="absolute inset-0 size-full object-cover opacity-20" />
        <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/25 text-white backdrop-blur">
          <Menu className="size-5" />
        </button>
      </div>
      <div className="-mt-12 flex flex-col items-center px-4">
        <Avatar src={ME.avatar} name={ME.name} size={96} ring="ring-4 ring-white" />
        <h1 className="mt-2 text-xl font-extrabold">{ME.name}</h1>
        <p className="text-sm text-zinc-500">@{ME.handle}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{ME.role}</p>

        <div className="mt-4 flex w-full max-w-xs justify-around text-center">
          {[
            [s.following.length, 'Following'],
            [s.xp, 'XP'],
            [s.certified.length, 'Certificates'],
          ].map(([n, label]) => (
            <div key={label}>
              <p className="text-lg font-extrabold">{n}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex w-full max-w-xs gap-2">
          <button type="button" onClick={() => toast('Demo: edit your profile')} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 py-2 text-sm font-semibold">
            <UserPen className="size-4" /> Edit profile
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${location.origin}${import.meta.env.BASE_URL}?u=${ME.handle}`).catch(() => undefined)
              toast('Profile link copied')
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 py-2 text-sm font-semibold"
          >
            <Share2 className="size-4" /> Share profile
          </button>
        </div>

        {/* Streak and level */}
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
              <Flame className="size-4 fill-orange-500 text-orange-500" /> Streak
            </p>
            <p className="mt-1 text-2xl font-extrabold text-orange-900">{s.streak.days} days</p>
            <p className="text-[11px] text-orange-800/80">Learn something every day</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-mpesa-50 to-mpesa-100 p-3.5">
            <p className="text-xs font-semibold text-mpesa-700">Level {level}</p>
            <p className="mt-1 text-2xl font-extrabold text-mpesa-700">{s.xp} XP</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${100 - toNext}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-mpesa-700/80">{toNext} XP to level {level + 1}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 mt-4 flex border-b border-zinc-200 bg-white">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-label={t.label} aria-pressed={tab === t.id} className={cn('relative flex flex-1 justify-center py-3', tab === t.id ? 'text-zinc-900' : 'text-zinc-400')}>
            <t.icon className="size-5" />
            {tab === t.id && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-zinc-900" />}
          </button>
        ))}
      </div>

      <div className="pb-6">
        {tab === 'courses' &&
          (mine.length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {mine.map((c) => {
                const p = progress(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => onOpenCourse(c.id)} className="relative aspect-[3/4] overflow-hidden text-left text-white">
                    <img src={c.cover} alt="" className="absolute inset-0 size-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    {s.certified.includes(c.id) && <span className="absolute top-1.5 right-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">🎓</span>}
                    <span className="absolute inset-x-1.5 bottom-1.5">
                      <span className="block truncate text-[11px] leading-tight font-bold">{c.title}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/30">
                        <span className="block h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
                      </span>
                      <span className="mt-0.5 block text-[10px] text-white/80">{p.pct}%</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <Empty text="Add a course from search on the Home tab." />
          ))}
        {(tab === 'saved' || tab === 'liked') &&
          (items(tab === 'saved' ? s.saved : s.liked).length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {items(tab === 'saved' ? s.saved : s.liked).map(({ item, course }) => (
                <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className="relative aspect-[3/4] overflow-hidden">
                  <ItemThumb item={item} course={course} className="size-full" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] font-semibold text-white">{course.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty text={tab === 'saved' ? 'Tap the bookmark on any post to save it here.' : 'Double-tap a post to like it.'} />
          ))}
        {tab === 'certificates' &&
          (s.certified.length ? (
            <ul className="space-y-3 p-4">
              {s.certified.map((id) => {
                const c = COURSES.find((x) => x.id === id)!
                return (
                  <li key={id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-[#fff7e6] to-[#ffe7b0] p-4">
                    <span className="text-3xl">🎓</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-amber-950">{c.title}</span>
                      <span className="block text-xs text-amber-900/80">Signed by {trainerOf(c.trainerId).name}</span>
                    </span>
                    <button type="button" onClick={() => toast('Certificate link copied')} className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-amber-900">
                      Share
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty text="Finish every post in a course to earn its certificate." />
          ))}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Settings" height="auto">
        <div className="space-y-1 px-3 pb-6">
          <button
            type="button"
            onClick={() => {
              reset()
              setMenu(false)
              toast('Demo data restored')
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-zinc-50"
          >
            <RotateCcw className="size-5 text-zinc-500" /> Reset demo data
          </button>
          <p className="px-3 pt-2 text-xs text-zinc-400">M-PESA Academy Lite · demo build. Everything you do is kept in this browser only.</p>
        </div>
      </Sheet>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-8 py-12 text-center text-sm text-zinc-500">{text}</p>
}
