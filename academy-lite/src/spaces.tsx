import { Bell, BellOff, ChevronDown, ChevronRight, Hash, Megaphone, Search } from 'lucide-react'
import { useState } from 'react'
import { ME, SPACES, channelChat, compact, type Chat } from './data'
import { ChatView } from './inbox'
import { unreadIn, useLite } from './store'
import { Avatar, cn, useToast } from './ui'

/**
 * Community spaces: the Academy and course groups on a rail, each with channels grouped in sections.
 * Announcement channels are for the training team; question channels are answered by trainers.
 */
export function SpacesView({ onTrainer }: { onTrainer: (trainerId: string) => void }) {
  const { s, set } = useLite()
  const toast = useToast()
  const [spaceId, setSpaceId] = useState(SPACES[0].id)
  const [open, setOpen] = useState<Chat | null>(null)
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<string[]>([])
  const space = SPACES.find((x) => x.id === spaceId)!
  const unreadSpace = (id: string) => SPACES.find((x) => x.id === id)!.sections.flatMap((sec) => sec.channels).reduce((n, ch) => n + unreadIn(s, ch.id), 0)

  return (
    <div className="relative flex h-full bg-zinc-100">
      {/* Spaces rail */}
      <nav aria-label="Spaces" className="scrollbar-none flex w-[72px] shrink-0 flex-col items-center gap-3 overflow-y-auto py-3">
        {SPACES.map((sp) => {
          const active = sp.id === spaceId
          const n = unreadSpace(sp.id)
          return (
            <button key={sp.id} type="button" onClick={() => setSpaceId(sp.id)} aria-label={sp.name} aria-current={active ? 'true' : undefined} className="relative">
              <span className={cn('absolute top-1/2 -left-3 w-1 -translate-y-1/2 rounded-r-full bg-zinc-900 transition-all', active ? 'h-9' : n ? 'h-2' : 'h-0')} />
              <span className={cn('grid size-12 place-items-center overflow-hidden transition-all', active ? 'rounded-2xl' : 'rounded-3xl', sp.id === 'academy' ? 'bg-[#d03c3b] p-2' : 'bg-white')}>
                <img src={sp.icon} alt="" className={cn('size-full', sp.id === 'academy' ? 'object-contain' : 'object-cover')} />
              </span>
              {n > 0 && <span className="absolute -right-1 -bottom-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-zinc-100 bg-[#d03c3b] px-1 text-[10px] font-bold text-white">{n}</span>}
            </button>
          )
        })}
      </nav>

      {/* Channels */}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-3xl bg-white">
        <div className="shrink-0 px-4 pt-4">
          <p className="flex items-center gap-1 text-lg leading-tight font-extrabold">
            <span className="truncate">{space.name}</span> <ChevronRight className="size-4 shrink-0 text-zinc-400" />
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {compact(space.members)} members · Community
          </p>
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
            <Search className="size-4 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-3">
          {space.sections.map((sec, si) => {
            const key = `${space.id}-${si}`
            const isClosed = closed.includes(key)
            const channels = sec.channels.filter((ch) => !q || ch.name.includes(q.toLowerCase().replace(/^#/, '')))
            if (!channels.length) return null
            return (
              <div key={key} className="mt-2">
                {sec.title && (
                  <button type="button" onClick={() => setClosed((c) => (isClosed ? c.filter((x) => x !== key) : [...c, key]))} className="flex items-center gap-1 px-2 py-1 text-xs font-bold tracking-wide text-zinc-500 uppercase">
                    {sec.title} {isClosed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                )}
                {!isClosed &&
                  channels.map((ch) => {
                    const n = unreadIn(s, ch.id)
                    return (
                      <button key={ch.id} type="button" onClick={() => setOpen(channelChat(space, ch))} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-zinc-50 active:bg-zinc-100">
                        {ch.kind === 'channel' ? <Megaphone className="size-4 shrink-0 text-zinc-400" /> : <Hash className="size-4 shrink-0 text-zinc-400" />}
                        <span className="text-base leading-none">{ch.emoji}</span>
                        <span className={cn('min-w-0 flex-1 truncate text-[15px]', n ? 'font-bold text-zinc-900' : 'text-zinc-600')}>{ch.name}</span>
                        {n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#d03c3b] px-1.5 text-[11px] font-bold text-white">{n}</span>}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>

        {/* You */}
        <div className="m-2 flex shrink-0 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <span className="relative">
            <Avatar src={ME.avatar} name={ME.name} size={38} />
            <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white bg-mpesa-500" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{ME.name}</span>
            <span className="block truncate text-xs text-zinc-500">{s.status || 'Online'}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              set((x) => ({ ...x, notifications: !x.notifications }))
              toast(s.notifications ? 'Notifications off' : 'Notifications on')
            }}
            aria-label={s.notifications ? 'Turn notifications off' : 'Turn notifications on'}
            className="grid size-9 place-items-center rounded-full hover:bg-zinc-100"
          >
            {s.notifications ? <Bell className="size-5" /> : <BellOff className="size-5 text-zinc-400" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-0 z-20">
          <ChatView chat={open} onBack={() => setOpen(null)} onTrainer={onTrainer} />
        </div>
      )}
    </div>
  )
}
