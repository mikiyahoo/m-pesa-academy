import { ArrowLeft, BadgeCheck, Bell, BellRing, Clock3, Globe2, Languages, Mail, MapPin, MessageCircle, MessagesSquare, MoreHorizontal, Phone, PhoneCall, Send, Star } from 'lucide-react'
import { useState } from 'react'
import { COURSES, LIVE, ME, availability, chatOfTrainer, compact, trainerOf } from './data'
import { useLite } from './store'
import { Avatar, Sheet, cn, useToast } from './ui'

const digits = (phone: string) => phone.replace(/\D/g, '')

/**
 * A trainer's profile: who they are, when they're available and every way to reach them —
 * live chat in the app, a phone call, WhatsApp, Telegram, email or a call-back request.
 */
export function TrainerProfile({ trainerId, onClose, onChat, onOpenCourse }: { trainerId: string; onClose: () => void; onChat: (trainerId: string, draft?: string) => void; onOpenCourse: (courseId: string) => void }) {
  const { s, set, toggle } = useLite()
  const toast = useToast()
  const t = trainerOf(trainerId)
  const [callback, setCallback] = useState(false)
  const courses = COURSES.filter((c) => c.trainerId === t.id)
  const learners = courses.reduce((n, c) => n + c.learners, 0)
  const live = LIVE.filter((l) => l.host === t.id)
  const following = s.following.includes(t.id)
  const mine = s.ratings[t.id]
  const { open, label } = availability(t)
  const firstName = t.name.split(' ')[0]
  const hello = encodeURIComponent(`Hello ${firstName}, I’m ${ME.name} from M-PESA Academy.`)

  const contacts = [
    { label: 'Live chat', icon: MessagesSquare, tone: 'bg-[#d03c3b]', run: () => onChat(t.id) },
    { label: 'Call', icon: Phone, tone: 'bg-mpesa-500', href: `tel:${t.phone}` },
    { label: 'WhatsApp', icon: MessageCircle, tone: 'bg-[#25a35a]', href: `https://wa.me/${digits(t.phone)}?text=${hello}` },
    { label: 'Telegram', icon: Send, tone: 'bg-sky-500', href: `https://t.me/${t.telegram}` },
    { label: 'Email', icon: Mail, tone: 'bg-zinc-600', href: `mailto:${t.email}?subject=${encodeURIComponent('M-PESA Academy question')}` },
    { label: 'Call me back', icon: PhoneCall, tone: 'bg-amber-500', run: () => setCallback(true) },
  ]

  return (
    <div className="animate-fade absolute inset-0 z-[55] flex flex-col bg-white text-zinc-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="size-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-bold">@{t.handle}</p>
        <button type="button" onClick={() => toast('Thanks, the Academy team will review it')} aria-label="Report" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        {/* Who they are */}
        <div className="flex flex-col items-center px-5 pt-5 text-center">
          <span className="relative">
            <Avatar src={t.avatar} name={t.name} size={96} ring="ring-4 ring-brand-50" />
            <span className={cn('absolute right-1 bottom-1 size-5 rounded-full border-[3px] border-white', open ? 'bg-mpesa-500' : 'bg-zinc-300')} aria-hidden />
          </span>
          <h1 className="mt-3 flex items-center gap-1.5 text-xl font-extrabold">
            {t.name} <BadgeCheck className="size-5 fill-[#d03c3b] text-white" aria-label="Academy trainer" />
          </h1>
          <p className="text-sm text-zinc-500">{t.title}</p>
          <p className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', open ? 'bg-mpesa-50 text-mpesa-700' : 'bg-zinc-100 text-zinc-600')}>
            <span className={cn('size-2 rounded-full', open ? 'bg-mpesa-500' : 'bg-zinc-400')} />
            {open ? `Available now · replies ${t.replies}` : `Away · ${label}`}
          </p>

          <div className="mt-4 flex w-full max-w-xs justify-around">
            {[
              [courses.length, 'Courses'],
              [compact(learners), 'Learners'],
              [`${t.rating.toFixed(1)}★`, 'Rating'],
            ].map(([n, l]) => (
              <div key={String(l)}>
                <p className="text-lg font-extrabold">{n}</p>
                <p className="text-xs text-zinc-500">{l}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex w-full max-w-xs gap-2">
            <button
              type="button"
              onClick={() => {
                toggle('following', t.id)
                toast(following ? `Unfollowed ${firstName}` : `Following ${firstName}. You’ll see their new posts first`)
              }}
              className={cn('flex-1 rounded-lg py-2.5 text-sm font-bold', following ? 'bg-zinc-100 text-zinc-800' : 'bg-[#d03c3b] text-white')}
            >
              {following ? 'Following' : 'Follow'}
            </button>
            <button type="button" onClick={() => onChat(t.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 py-2.5 text-sm font-bold">
              <MessagesSquare className="size-4" /> Message
            </button>
          </div>
        </div>

        {/* Get in touch */}
        <section className="mt-6 px-4">
          <h2 className="text-sm font-bold">Get in touch</h2>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {contacts.map((c) => {
              const body = (
                <>
                  <span className={cn('grid size-11 place-items-center rounded-full text-white', c.tone)}>
                    <c.icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold text-zinc-700">{c.label}</span>
                </>
              )
              const cls = 'flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-100 bg-zinc-50/60 py-3 transition active:scale-95'
              return c.href ? (
                <a key={c.label} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>
                  {body}
                </a>
              ) : (
                <button key={c.label} type="button" onClick={c.run} className={cls}>
                  {body}
                </button>
              )
            })}
          </div>
          {!open && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{firstName} is outside office hours. Send a message or ask for a call back and they’ll reply when they’re back.</p>}
        </section>

        {/* Quick questions */}
        <section className="mt-6 px-4">
          <h2 className="text-sm font-bold">Ask a quick question</h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {t.faqs.map((q) => (
              <button key={q} type="button" onClick={() => onChat(t.id, q)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* Details */}
        <section className="mt-6 px-4">
          <h2 className="text-sm font-bold">About</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{t.bio}</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            <li className="flex items-center gap-2.5">
              <Clock3 className="size-4 text-zinc-400" /> Office hours: {label}
            </li>
            <li className="flex items-center gap-2.5">
              <MessagesSquare className="size-4 text-zinc-400" /> Usually replies {t.replies}
            </li>
            <li className="flex items-center gap-2.5">
              <Languages className="size-4 text-zinc-400" /> Speaks {t.languages.join(', ')}
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 text-zinc-400" /> Based in {t.region}
            </li>
          </ul>
        </section>

        {/* Courses */}
        {courses.length > 0 && (
          <section className="mt-6">
            <h2 className="px-4 text-sm font-bold">Courses by {firstName}</h2>
            <div className="scrollbar-none mt-2.5 flex gap-3 overflow-x-auto px-4 pb-1">
              {courses.map((c) => (
                <button key={c.id} type="button" onClick={() => onOpenCourse(c.id)} className="w-40 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 text-left">
                  <img src={c.cover} alt="" className="h-20 w-full object-cover" />
                  <span className="block p-2.5">
                    <span className="block truncate text-sm font-bold">{c.title}</span>
                    <span className="block text-[11px] text-zinc-500">
                      {c.items.length} posts · {compact(c.learners)} learners
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Live sessions */}
        {live.length > 0 && (
          <section className="mt-6 px-4">
            <h2 className="text-sm font-bold">Live sessions</h2>
            <ul className="mt-2.5 space-y-2">
              {live.map((l) => {
                const on = s.reminders.includes(l.id)
                return (
                  <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 p-3">
                    <span className={cn('grid size-10 place-items-center rounded-xl text-xs font-extrabold', l.live ? 'bg-rose-500 text-white' : 'bg-zinc-100 text-zinc-600')}>{l.live ? 'LIVE' : <Globe2 className="size-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.title}</span>
                      <span className="block text-xs text-zinc-500">{l.when}</span>
                    </span>
                    {l.live ? (
                      <button type="button" onClick={() => toast('Demo: this would open the live session')} className="rounded-full bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white">
                        Join
                      </button>
                    ) : (
                      <button type="button" onClick={() => (toggle('reminders', l.id), toast(on ? 'Reminder removed' : 'We’ll remind you 10 minutes before'))} aria-pressed={on} className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold', on ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-white')}>
                        {on ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />} {on ? 'Set' : 'Remind me'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-6 px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">
              Reviews · {t.rating.toFixed(1)} <Star className="mb-0.5 inline size-3.5 fill-amber-400 text-amber-400" />
            </h2>
          </div>
          <div className="mt-2.5 rounded-2xl bg-zinc-50 p-3">
            <p className="text-xs font-semibold text-zinc-600">{mine ? 'Your rating' : `Rate ${firstName}`}</p>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => {
                    set((x) => ({ ...x, ratings: { ...x.ratings, [t.id]: n } }))
                    toast(`Thanks! You rated ${firstName} ${n}★`)
                  }}
                >
                  <Star className={cn('size-7', mine && n <= mine ? 'fill-amber-400 text-amber-400' : 'text-zinc-300')} />
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-3">
            {t.reviews.map((rv) => (
              <li key={rv.name + rv.text} className="flex gap-3">
                <Avatar name={rv.name} size={34} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                    {rv.name}
                    <span className="text-amber-500">{'★'.repeat(rv.stars)}</span>
                    <span className="font-normal">· {rv.ago}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-800">{rv.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 px-4 text-center text-[11px] text-zinc-400">Demo contact details. In the live app these come from the trainer’s Academy profile.</p>
      </div>

      {callback && <CallbackSheet trainerId={t.id} onClose={() => setCallback(false)} />}
    </div>
  )
}

const SLOTS = ['As soon as possible', 'Today, afternoon', 'Tomorrow, morning', 'Tomorrow, afternoon']

/** Ask the trainer to phone you: when, about what, and on which number. It also lands in your chat with them. */
function CallbackSheet({ trainerId, onClose }: { trainerId: string; onClose: () => void }) {
  const { set } = useLite()
  const toast = useToast()
  const t = trainerOf(trainerId)
  const courses = COURSES.filter((c) => c.trainerId === t.id)
  const [slot, setSlot] = useState(SLOTS[0])
  const [topic, setTopic] = useState(courses[0]?.title ?? 'Something else')
  const [phone, setPhone] = useState(ME.phone)
  const chat = chatOfTrainer(t.id)

  const send = () => {
    const at = Date.now()
    set((x) => ({ ...x, chats: { ...x.chats, [chat.id]: [...(x.chats[chat.id] ?? []), { id: `cb-${at}`, from: 'me', text: `📞 Call-back request · ${slot} · ${topic} · ${phone}`, at }] } }))
    // The trainer confirms in the chat a moment later.
    window.setTimeout(() => {
      set((x) => ({ ...x, chats: { ...x.chats, [chat.id]: [...(x.chats[chat.id] ?? []), { id: `cbr-${Date.now()}`, from: chat.id, text: `Got it 👍 I’ll call you ${slot.toLowerCase()} on ${phone}.`, at: Date.now() }] } }))
    }, 1800)
    toast(`Call-back requested. ${t.name.split(' ')[0]} will phone you`)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={`Ask ${t.name.split(' ')[0]} to call you`} height="auto">
      <div className="space-y-4 px-4 pb-6">
        <div>
          <p className="text-xs font-semibold text-zinc-500">When</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SLOTS.map((x) => (
              <button key={x} type="button" onClick={() => setSlot(x)} aria-pressed={slot === x} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', slot === x ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700')}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-500">About</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...courses.map((c) => c.title), 'Something else'].map((x) => (
              <button key={x} type="button" onClick={() => setTopic(x)} aria-pressed={topic === x} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', topic === x ? 'bg-[#d03c3b] text-white' : 'bg-zinc-100 text-zinc-700')}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-500">Your number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1.5 w-full rounded-xl bg-zinc-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-300" />
        </label>
        <button type="button" disabled={phone.replace(/\D/g, '').length < 9} onClick={send} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d03c3b] py-3 text-sm font-bold text-white disabled:opacity-40">
          <PhoneCall className="size-4" /> Request call back
        </button>
      </div>
    </Sheet>
  )
}
