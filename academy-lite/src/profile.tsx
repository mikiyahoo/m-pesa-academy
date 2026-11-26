import { Activity, ArrowLeft, Award, Bell, Bookmark, Camera, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Grid3x3, Info, Languages, Menu, MessageSquareText, QrCode, RotateCcw, Share2, Sparkles, UserPen } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { COURSES, ME, findItem, trainerOf } from './data'
import { ItemThumb } from './sheets'
import { useLite } from './store'
import { Avatar, Sheet, cn, useToast } from './ui'

type Tab = 'courses' | 'activity' | 'saved' | 'certificates'
const profileLink = () => `${location.origin}${import.meta.env.BASE_URL}?u=${ME.handle}`

/** Your learning at a glance: status, badges, dashboard, courses, activity, saved posts and certificates. */
export function Profile({ onOpenCourse, onOpenItem }: { onOpenCourse: (courseId: string) => void; onOpenItem: (itemId: string) => void }) {
  const { s, progress } = useLite()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('courses')
  const [sheet, setSheet] = useState<'status' | 'qr' | null>(null)
  const [settings, setSettings] = useState(false)
  const [dash, setDash] = useState(false)
  const level = Math.floor(s.xp / 100) + 1
  const toNext = 100 - (s.xp % 100)
  const mine = COURSES.filter((c) => s.enrolled.includes(c.id))
  const items = (ids: string[]) => ids.map(findItem).filter((x): x is NonNullable<ReturnType<typeof findItem>> => !!x)
  const answered = Object.entries(s.quiz)
  const right = answered.filter(([id, choice]) => {
    const f = findItem(id)
    return f?.item.kind === 'quiz' && f.item.answer === choice
  }).length

  // Badges you have earned so far, shown as a row of small icons.
  const badges = [
    s.streak.days >= 3 && { icon: '🔥', label: `${s.streak.days}-day streak` },
    s.certified.length > 0 && { icon: '🎓', label: 'Certified' },
    right >= 3 && { icon: '🧠', label: 'Quiz whiz' },
    s.liked.length >= 5 && { icon: '❤️', label: 'Big fan' },
    Object.keys(s.comments).length > 0 && { icon: '💬', label: 'Joined the conversation' },
    s.following.length >= 2 && { icon: '🤝', label: 'Following trainers' },
  ].filter(Boolean) as { icon: string; label: string }[]

  const share = () => {
    void navigator.clipboard?.writeText(profileLink()).catch(() => undefined)
    toast('Profile link copied')
  }

  const tabs: { id: Tab; icon: typeof Grid3x3; label: string }[] = [
    { id: 'courses', icon: Grid3x3, label: 'My courses' },
    { id: 'activity', icon: Activity, label: 'Activity' },
    { id: 'saved', icon: Bookmark, label: 'Saved' },
    { id: 'certificates', icon: Award, label: 'Certificates' },
  ]

  return (
    <div className="relative h-full overflow-y-auto bg-white text-zinc-900">
      {/* Banner with QR (left) and menu (right) */}
      <div className="relative h-28 bg-gradient-to-br from-[#d03c3b] via-[#b8302f] to-[#39b54a]">
        <img src="/M-PESA Pattern.svg" alt="" className="absolute inset-0 size-full object-cover opacity-20" />
        <button type="button" onClick={() => setSheet('qr')} aria-label="My QR code" className="absolute top-3 left-3 grid size-10 place-items-center rounded-full bg-white/90 text-zinc-900 shadow">
          <QrCode className="size-5" />
        </button>
        <button type="button" onClick={() => setSettings(true)} aria-label="Settings" className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-zinc-900 shadow">
          <Menu className="size-5" />
        </button>
      </div>

      {/* Photo + status bubble */}
      <div className="relative -mt-11 flex items-end gap-3 px-4">
        <span className="relative shrink-0">
          <Avatar src={ME.avatar} name={ME.name} size={92} ring="ring-4 ring-white" />
          <span className="absolute right-1 bottom-1 size-5 rounded-full border-[3px] border-white bg-mpesa-500" aria-label="Online" />
          <button type="button" onClick={() => toast('Demo: change your photo')} aria-label="Change photo" className="absolute -top-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-white bg-sky-500 text-white">
            <Camera className="size-3.5" />
          </button>
        </span>
        <button type="button" onClick={() => setSheet('status')} className="relative mb-3 min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-left shadow-sm">
          <span className="absolute -left-1.5 bottom-2 size-3 rounded-full border border-zinc-200 bg-white" aria-hidden />
          <span className="block truncate text-sm font-medium text-zinc-700 italic">{s.status || '+ What are you learning?'}</span>
        </button>
      </div>

      <div className="px-4 pt-2">
        <h1 className="text-2xl leading-tight font-extrabold">{ME.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-500">@{ME.handle}</p>
          {badges.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5" aria-label={`Badges: ${badges.map((b) => b.label).join(', ')}`}>
              {badges.map((b) => (
                <span key={b.label} title={b.label} className="text-sm leading-none">
                  {b.icon}
                </span>
              ))}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">{ME.role}</p>

        <div className="mt-4 flex justify-between text-center">
          {[
            [s.following.length, 'Following'],
            [s.xp, 'XP'],
            [s.certified.length, 'Certificates'],
            [`${s.streak.days}🔥`, 'Streak'],
          ].map(([n, label]) => (
            <div key={label} className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">{n}</p>
              <p className="text-[11px] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => toast('Demo: edit your profile')} className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 py-2.5 text-[13px] font-semibold">
            <UserPen className="size-4" /> Edit
          </button>
          <button type="button" onClick={share} className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 py-2.5 text-[13px] font-semibold">
            <Share2 className="size-4" /> Share
          </button>
          <button type="button" onClick={() => setSheet('qr')} className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 py-2.5 text-[13px] font-semibold">
            <QrCode className="size-4" /> QR code
          </button>
        </div>

        {/* Learning dashboard */}
        <button type="button" onClick={() => setDash((d) => !d)} aria-expanded={dash} className="mt-3 w-full rounded-2xl bg-zinc-100 px-4 py-3.5 text-left">
          <span className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#d03c3b]">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Your learning dashboard</span>
              <span className="block text-xs text-zinc-500">
                Level {level} · {toNext} XP to level {level + 1} · {s.viewed.length} posts seen
              </span>
            </span>
            <ChevronDown className={cn('size-5 shrink-0 text-zinc-400 transition', dash && 'rotate-180')} />
          </span>
          {dash && (
            <span className="mt-3 block space-y-3 border-t border-zinc-200 pt-3">
              <span className="grid grid-cols-3 gap-2 text-center">
                {[
                  [`${s.viewed.length * 2} min`, 'Learning time'],
                  [answered.length ? `${Math.round((right / answered.length) * 100)}%` : '—', 'Quiz score'],
                  [s.saved.length, 'Saved'],
                ].map(([n, l]) => (
                  <span key={l} className="rounded-xl bg-white py-2">
                    <span className="block text-base font-extrabold">{n}</span>
                    <span className="block text-[11px] text-zinc-500">{l}</span>
                  </span>
                ))}
              </span>
              {mine.map((c) => {
                const p = progress(c.id)
                return (
                  <span key={c.id} className="block">
                    <span className="flex justify-between text-xs font-medium">
                      <span className="truncate">{c.title}</span>
                      <span className="text-zinc-500">{p.pct}%</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white">
                      <span className="block h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
                    </span>
                  </span>
                )
              })}
            </span>
          )}
        </button>
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

        {tab === 'activity' && <ActivityList onOpenItem={onOpenItem} />}

        {tab === 'saved' &&
          (items(s.saved).length ? (
            <div className="grid grid-cols-3 gap-0.5">
              {items(s.saved).map(({ item, course }) => (
                <button key={item.id} type="button" onClick={() => onOpenItem(item.id)} className="relative aspect-[3/4] overflow-hidden">
                  <ItemThumb item={item} course={course} className="size-full" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] font-semibold text-white">{course.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty text="Tap the bookmark on any post to save it here." />
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

      {sheet === 'status' && <StatusSheet onClose={() => setSheet(null)} />}
      {sheet === 'qr' && <QrSheet onClose={() => setSheet(null)} />}
      {settings && <SettingsScreen onClose={() => setSettings(false)} onTab={(t) => (setTab(t), setSettings(false))} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-8 py-12 text-center text-sm text-zinc-500">{text}</p>
}

/** What you have done, newest kinds first: certificates, quiz answers, saves and likes. */
function ActivityList({ onOpenItem }: { onOpenItem: (itemId: string) => void }) {
  const { s } = useLite()
  const rows: { key: string; icon: string; text: string; itemId?: string }[] = [
    ...s.certified.map((id) => ({ key: `c-${id}`, icon: '🎓', text: `Earned the certificate for ${COURSES.find((c) => c.id === id)?.title}` })),
    ...Object.entries(s.quiz).map(([id, choice]) => {
      const f = findItem(id)
      const ok = f?.item.kind === 'quiz' && f.item.answer === choice
      return { key: `q-${id}`, icon: ok ? '✅' : '💡', text: `${ok ? 'Got it right' : 'Learned the answer'}: ${f?.item.kind === 'quiz' ? f.item.question : ''}`, itemId: id }
    }),
    ...s.saved.map((id) => ({ key: `s-${id}`, icon: '🔖', text: `Saved a post from ${findItem(id)?.course.title ?? 'a course'}`, itemId: id })),
    ...s.liked.filter((id) => findItem(id)).map((id) => ({ key: `l-${id}`, icon: '❤️', text: `Liked a post from ${findItem(id)?.course.title}`, itemId: id })),
  ]
  if (!rows.length) return <Empty text="Watch, answer, like and save posts. Everything you do shows up here." />
  return (
    <ul className="divide-y divide-zinc-100">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" disabled={!r.itemId} onClick={() => r.itemId && onOpenItem(r.itemId)} className="flex w-full items-center gap-3 px-4 py-3 text-left enabled:hover:bg-zinc-50">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-base">{r.icon}</span>
            <span className="min-w-0 flex-1 text-sm text-zinc-700">{r.text}</span>
            {r.itemId && <ChevronRight className="size-4 shrink-0 text-zinc-300" />}
          </button>
        </li>
      ))}
    </ul>
  )
}

const STATUSES = ['📚 Learning Spot the Scam', '🎯 Going for a 7-day streak', '🙋 Ask me about Fayda', '🏪 Helping merchants today', '☕ On a learning break']

function StatusSheet({ onClose }: { onClose: () => void }) {
  const { s, set } = useLite()
  const [text, setText] = useState(s.status)
  const save = (v: string) => {
    set((x) => ({ ...x, status: v.trim() }))
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Your status" height="auto">
      <div className="space-y-3 px-4 pb-6">
        <input autoFocus value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder="What are you learning?" className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300" />
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((x) => (
            <button key={x} type="button" onClick={() => save(x)} className={cn('rounded-full px-3 py-1.5 text-sm', s.status === x ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700')}>
              {x}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => save('')} className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold">
            Clear
          </button>
          <button type="button" onClick={() => save(text)} className="flex-1 rounded-xl bg-[#d03c3b] py-2.5 text-sm font-bold text-white">
            Save
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function QrSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [src, setSrc] = useState('')
  useEffect(() => {
    void QRCode.toDataURL(profileLink(), { margin: 1, width: 360, color: { dark: '#111111', light: '#ffffff' } }).then(setSrc)
  }, [])
  return (
    <Sheet open onClose={onClose} title="My QR code" height="auto">
      <div className="flex flex-col items-center px-6 pb-7">
        <div className="relative rounded-3xl bg-gradient-to-br from-[#d03c3b] to-[#39b54a] p-1.5">
          <div className="rounded-[1.25rem] bg-white p-4">{src ? <img src={src} alt="QR code for your profile" className="size-52" /> : <div className="size-52" />}</div>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Avatar src={ME.avatar} name={ME.name} size={52} ring="ring-4 ring-white" />
          </span>
        </div>
        <p className="mt-4 text-base font-bold">{ME.name}</p>
        <p className="text-sm text-zinc-500">@{ME.handle}</p>
        <p className="mt-2 text-center text-xs text-zinc-500">Classmates scan this to follow your learning.</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(profileLink()).catch(() => undefined)
            toast('Profile link copied')
          }}
          className="mt-4 flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <Copy className="size-4" /> Copy link
        </button>
      </div>
    </Sheet>
  )
}

const LANGS = ['English', 'አማርኛ (Amharic)', 'Afaan Oromoo', 'ትግርኛ (Tigrinya)', 'Soomaali']

/** Settings in grouped cards with coloured icons, like the phone settings people know. */
function SettingsScreen({ onClose, onTab }: { onClose: () => void; onTab: (t: Tab) => void }) {
  const { s, set, reset } = useLite()
  const toast = useToast()
  const [langs, setLangs] = useState(false)
  const Row = ({ icon: Icon, tone, label, value, onClick, danger, toggle }: { icon: typeof Bell; tone: string; label: string; value?: string; onClick: () => void; danger?: boolean; toggle?: boolean }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl text-white', tone)}>
        <Icon className="size-5" />
      </span>
      <span className={cn('min-w-0 flex-1 text-[15px] font-medium', danger && 'text-[#d03c3b]')}>{label}</span>
      {toggle !== undefined ? (
        <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition', toggle ? 'bg-mpesa-500' : 'bg-zinc-300')}>
          <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', toggle ? 'left-[22px]' : 'left-0.5')} />
        </span>
      ) : (
        <>
          {value && <span className="max-w-[45%] truncate text-sm text-zinc-500">{value}</span>}
          <ChevronRight className="size-4 shrink-0 text-zinc-300" />
        </>
      )}
    </button>
  )
  return (
    <div className="animate-fade absolute inset-0 z-30 flex flex-col bg-zinc-100">
      <div className="flex shrink-0 items-center gap-2 bg-zinc-100 px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-10 place-items-center rounded-full bg-white shadow-sm">
          <ArrowLeft className="size-5" />
        </button>
        <p className="flex-1 text-center text-base font-bold">Settings</p>
        <span className="size-10" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-6">
        <div className="flex flex-col items-center py-3">
          <Avatar src={ME.avatar} name={ME.name} size={84} />
          <p className="mt-2 text-xl font-extrabold">{ME.name}</p>
          <p className="text-sm text-zinc-500">
            {ME.phone} · @{ME.handle}
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white">
          <Row icon={MessageSquareText} tone="bg-sky-500" label="Status" value={s.status || 'Not set'} onClick={() => (onClose(), toast('Tap the bubble next to your photo to change it'))} />
          <Row
            icon={Bell}
            tone="bg-[#d03c3b]"
            label="Notifications"
            toggle={s.notifications}
            onClick={() => {
              set((x) => ({ ...x, notifications: !x.notifications }))
              toast(s.notifications ? 'Notifications off' : 'Notifications on')
            }}
          />
          <Row icon={Languages} tone="bg-violet-500" label="Language" value={s.lang} onClick={() => setLangs(true)} />
        </div>
        <div className="overflow-hidden rounded-2xl bg-white">
          <Row icon={Bookmark} tone="bg-amber-500" label="Saved posts" value={String(s.saved.length)} onClick={() => onTab('saved')} />
          <Row icon={Award} tone="bg-mpesa-500" label="Certificates" value={String(s.certified.length)} onClick={() => onTab('certificates')} />
          <Row icon={Activity} tone="bg-pink-500" label="Activity" onClick={() => onTab('activity')} />
        </div>
        <div className="overflow-hidden rounded-2xl bg-white">
          <Row icon={CircleHelp} tone="bg-teal-500" label="Help & support" value="Ask a trainer" onClick={() => toast('Open any trainer’s profile to chat, call or ask for a call back')} />
          <Row icon={Info} tone="bg-zinc-500" label="About Academy Lite" value="Demo" onClick={() => toast('M-PESA Academy Lite · demo build')} />
          <Row
            icon={RotateCcw}
            tone="bg-zinc-800"
            label="Reset demo data"
            danger
            onClick={() => {
              reset()
              onClose()
              toast('Demo data restored')
            }}
          />
        </div>
        <p className="px-2 text-center text-[11px] text-zinc-400">Everything you do is kept in this browser only.</p>
      </div>

      <Sheet open={langs} onClose={() => setLangs(false)} title="Language" height="auto">
        <ul className="px-3 pb-6">
          {LANGS.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => {
                  set((x) => ({ ...x, lang: l }))
                  setLangs(false)
                  toast(l === 'English' ? 'Language: English' : `${l} selected. Translations come in the full release`)
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-50"
              >
                {l}
                {s.lang === l && <Check className="size-5 text-mpesa-600" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}
