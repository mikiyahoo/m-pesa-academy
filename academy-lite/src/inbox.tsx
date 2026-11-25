import { ArrowLeft, BellOff, Camera, CheckCheck, Eye, Mic, Paperclip, Pin, Phone, Play, Search, Send, Smile, SquarePen, Video } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CHATS, CLASSMATES, trainerReply, type Chat, type Msg } from './data'
import { unreadIn, useLite } from './store'
import { Avatar, cn, timeLabel, useToast } from './ui'

type Filter = 'all' | 'unread' | 'trainer' | 'group' | 'channel'
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['trainer', 'Trainers'],
  ['group', 'Groups'],
  ['channel', 'Channels'],
]

const preview = (m?: Msg) => (!m ? '' : m.kind === 'voice' ? '🎤 Voice message' : m.kind === 'share' ? '📘 Shared a post' : m.text)

/** Chats: trainers, class groups and the Academy announcements channel. */
export function Inbox() {
  const { s } = useLite()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Chat | null>(null)

  const rows = useMemo(
    () =>
      CHATS.map((c) => ({ c, last: (s.chats[c.id] ?? []).at(-1), unread: unreadIn(s, c.id) }))
        .filter(({ c, unread }) => (filter === 'all' ? true : filter === 'unread' ? unread > 0 : c.kind === filter))
        .filter(({ c }) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(!!b.c.pinned) - Number(!!a.c.pinned) || (b.last?.at ?? 0) - (a.last?.at ?? 0)),
    [s, filter, q],
  )

  if (open) return <ChatView chat={open} onBack={() => setOpen(null)} />

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900">
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Chats</h1>
        <div className="flex gap-1">
          <button type="button" onClick={() => toast('Demo: camera')} aria-label="Camera" className="grid size-10 place-items-center rounded-full hover:bg-zinc-100">
            <Camera className="size-5" />
          </button>
          <button type="button" onClick={() => toast('Demo: start a new chat')} aria-label="New chat" className="grid size-10 place-items-center rounded-full hover:bg-zinc-100">
            <SquarePen className="size-5" />
          </button>
        </div>
      </div>
      <label className="mx-4 flex shrink-0 items-center gap-2 rounded-full bg-zinc-100 px-4 py-2.5">
        <Search className="size-4 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto px-4 py-3">
        {FILTERS.map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition', filter === v ? 'bg-mpesa-100 text-mpesa-700' : 'bg-zinc-100 text-zinc-600')}>
            {label}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.map(({ c, last, unread }) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50 active:bg-zinc-100">
              <Avatar src={c.avatar} name={c.name} size={52} className={c.kind === 'channel' ? 'bg-[#d03c3b] p-2' : undefined} />
              <span className="min-w-0 flex-1 border-b border-zinc-100 pb-2.5">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{c.name}</span>
                  <span className={cn('shrink-0 text-xs', unread ? 'font-semibold text-mpesa-600' : 'text-zinc-400')}>{last ? timeLabel(last.at) : ''}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
                    {last?.from === 'me' && <CheckCheck className="mr-1 inline size-4 text-sky-500" />}
                    {c.kind === 'group' && last && last.from !== 'me' ? `${last.from.split(' ')[0]}: ` : ''}
                    {preview(last)}
                  </span>
                  {c.muted && <BellOff className="size-3.5 shrink-0 text-zinc-400" />}
                  {c.pinned && !unread && <Pin className="size-3.5 shrink-0 rotate-45 text-zinc-400" />}
                  {unread > 0 && <span className={cn('grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white', c.muted ? 'bg-zinc-400' : 'bg-mpesa-500')}>{unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-10 text-center text-sm text-zinc-500">No chats here.</li>}
      </ul>
    </div>
  )
}

/* ------------------------------------ chat ------------------------------------ */

const SENDER_COLOURS = ['text-[#d03c3b]', 'text-sky-600', 'text-violet-600', 'text-amber-600', 'text-emerald-600']
const colourOf = (name: string) => SENDER_COLOURS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % SENDER_COLOURS.length]

function ChatView({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const { s, set } = useLite()
  const toast = useToast()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState<string | null>(null)
  const [emoji, setEmoji] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const messages = s.chats[chat.id] ?? []
  const channel = chat.kind === 'channel'

  // Opening a chat (and every new message) marks it read and scrolls to the bottom.
  useEffect(() => {
    set((x) => ({ ...x, lastRead: { ...x.lastRead, [chat.id]: Date.now() } }))
    end.current?.scrollIntoView({ block: 'end' })
  }, [chat.id, messages.length, typing, set])

  const push = (m: Omit<Msg, 'id' | 'at'>) => set((x) => ({ ...x, chats: { ...x.chats, [chat.id]: [...(x.chats[chat.id] ?? []), { ...m, id: `${Date.now()}-${Math.random()}`, at: Date.now() }] } }))

  const send = (value: string, kind: Msg['kind'] = 'text') => {
    const v = value.trim()
    if (!v) return
    push({ from: 'me', text: v, kind })
    setText('')
    setEmoji(false)
    // Trainers answer; classmates in a group sometimes chime in.
    if (chat.kind === 'trainer') {
      window.setTimeout(() => setTyping(chat.name.split(' ')[0]), 600)
      window.setTimeout(() => {
        setTyping(null)
        push({ from: chat.id, text: trainerReply(kind === 'voice' ? 'voice' : v) })
      }, 2000)
    } else if (chat.kind === 'group') {
      const mate = CLASSMATES[Math.floor(Math.random() * CLASSMATES.length)]
      window.setTimeout(() => setTyping(mate.name.split(' ')[0]), 900)
      window.setTimeout(() => {
        setTyping(null)
        push({ from: mate.name, text: ['👍', 'Same here!', 'Good point 💯', 'Thanks for sharing 🙏'][Math.floor(Math.random() * 4)] })
      }, 2300)
    }
  }

  // Day separators between messages.
  const withDays: ({ day: string } | Msg)[] = []
  let lastDay = ''
  for (const m of messages) {
    const d = new Date(m.at).toDateString()
    if (d !== lastDay) {
      const today = new Date().toDateString()
      const yest = new Date(Date.now() - 86_400_000).toDateString()
      withDays.push({ day: d === today ? 'Today' : d === yest ? 'Yesterday' : new Date(m.at).toLocaleDateString([], { day: 'numeric', month: 'long' }) })
      lastDay = d
    }
    withDays.push(m)
  }

  const status = typing ? `${chat.kind === 'group' ? `${typing} is ` : ''}typing…` : channel ? `${chat.members?.toLocaleString()} subscribers` : chat.kind === 'group' ? `${chat.members} members` : 'online'

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-2 py-2">
        <button type="button" onClick={onBack} aria-label="Back to chats" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="size-5" />
        </button>
        <Avatar src={chat.avatar} name={chat.name} size={40} className={channel ? 'bg-[#d03c3b] p-1.5' : undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{chat.name}</p>
          <p className={cn('truncate text-xs', typing ? 'text-mpesa-600' : 'text-zinc-500')}>{status}</p>
        </div>
        {!channel && (
          <>
            <button type="button" onClick={() => toast('Demo: video call')} aria-label="Video call" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
              <Video className="size-5" />
            </button>
            <button type="button" onClick={() => toast('Demo: voice call')} aria-label="Voice call" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
              <Phone className="size-5" />
            </button>
          </>
        )}
      </div>

      <div className="chat-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {withDays.map((m, i) =>
          'day' in m ? (
            <div key={`d-${m.day}-${i}`} className="my-3 flex justify-center">
              <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-zinc-500 shadow-sm">{m.day}</span>
            </div>
          ) : (
            <Bubble key={m.id} m={m} chat={chat} />
          ),
        )}
        {typing && (
          <div className="mt-1 flex">
            <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={end} />
      </div>

      {channel ? (
        <div className="shrink-0 border-t border-zinc-100 bg-white p-3 text-center text-sm font-semibold text-mpesa-700">Only the Academy team can post here</div>
      ) : (
        <div className="shrink-0 bg-[#f0f2f5] px-2 pt-2 pb-2.5">
          {emoji && (
            <div className="mb-2 flex justify-around rounded-xl bg-white py-2 text-2xl">
              {['😀', '🙏', '👍', '🔥', '💡', '🎉', '😂', '❤️'].map((e) => (
                <button key={e} type="button" onClick={() => setText((t) => t + e)} aria-label={`Add ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(text)
            }}
            className="flex items-center gap-2"
          >
            <span className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-white px-2 py-1">
              <button type="button" onClick={() => setEmoji((v) => !v)} aria-label="Emoji" className="grid size-8 place-items-center text-zinc-500">
                <Smile className="size-5" />
              </button>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none" />
              <button type="button" onClick={() => toast('Demo: attach a file or photo')} aria-label="Attach" className="grid size-8 place-items-center text-zinc-500">
                <Paperclip className="size-5" />
              </button>
            </span>
            {text.trim() ? (
              <button type="submit" aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-mpesa-500 text-white">
                <Send className="size-5" />
              </button>
            ) : (
              <button type="button" onClick={() => send('🎤 Voice message', 'voice')} aria-label="Send a voice message" className="grid size-11 shrink-0 place-items-center rounded-full bg-mpesa-500 text-white">
                <Mic className="size-5" />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}

function Bubble({ m, chat }: { m: Msg; chat: Chat }) {
  const mine = m.from === 'me'
  const time = new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (chat.kind === 'channel')
    return (
      <div className="mb-2 max-w-[88%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
        <p className="text-xs font-bold text-[#d03c3b]">M-PESA Academy</p>
        <p className="mt-1 text-[15px] leading-snug">{m.text}</p>
        <p className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-zinc-400">
          <Eye className="size-3" /> {m.views?.toLocaleString()} · {time}
        </p>
      </div>
    )
  return (
    <div className={cn('mb-1.5 flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 shadow-sm', mine ? 'rounded-tr-sm bg-mpesa-100' : 'rounded-tl-sm bg-white')}>
        {chat.kind === 'group' && !mine && <p className={cn('text-xs font-bold', colourOf(m.from))}>{m.from}</p>}
        {m.kind === 'voice' ? (
          <span className="flex items-center gap-2 py-1">
            <span className="grid size-8 place-items-center rounded-full bg-mpesa-500 text-white">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
            <span className="flex h-6 items-center gap-0.5">
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className="w-0.5 rounded-full bg-zinc-400" style={{ height: `${6 + ((i * 7) % 16)}px` }} />
              ))}
            </span>
            <span className="text-xs text-zinc-500">0:12</span>
          </span>
        ) : m.kind === 'share' ? (
          <span className="my-1 block rounded-xl border border-mpesa-500/30 bg-white/70 p-2.5 text-sm">
            <span className="block text-[11px] font-bold text-[#d03c3b]">Shared from Academy Lite</span>
            {m.text}
          </span>
        ) : (
          <span className="text-[15px] leading-snug break-words">{m.text}</span>
        )}
        <span className="float-right mt-1 ml-2 flex items-center gap-0.5 text-[10px] text-zinc-400">
          {time}
          {mine && <CheckCheck className="size-3.5 text-sky-500" />}
        </span>
      </div>
    </div>
  )
}
