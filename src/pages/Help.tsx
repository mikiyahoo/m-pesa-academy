import { ArrowRight, Award, BookOpenText, ChevronDown, ClipboardCheck, LifeBuoy, MessageSquare, PlayCircle, Search, Send, ThumbsDown, ThumbsUp, Video, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../store/Auth'
import { useRef, useState, type FormEvent } from 'react'
import { guides, type Guide } from '../data/guides'
import { formatDate } from '../lib/utils'
import { useFeedback } from '../components/Feedback'
import { cn } from '../lib/utils'
import { useDialogFocus } from '../lib/useDialogFocus'

type Topic = 'start' | 'sessions' | 'assessments' | 'certificates'

const TOPICS: { id: Topic; icon: typeof Award; title: string; text: string; tile: string }[] = [
  { id: 'start', icon: PlayCircle, title: 'Getting started', text: 'Find trainings and work through a course.', tile: 'bg-brand-50 text-brand-600' },
  { id: 'sessions', icon: Video, title: 'Live sessions', text: 'Joining on Teams, check-in and attendance.', tile: 'bg-zinc-100 text-zinc-800' },
  { id: 'assessments', icon: ClipboardCheck, title: 'Assessments', text: 'Attempts, time limits and pass marks.', tile: 'bg-amber-500/10 text-amber-600' },
  { id: 'certificates', icon: Award, title: 'Certificates', text: 'Earning, downloading and verifying.', tile: 'bg-mpesa-500/10 text-mpesa-600' },
]

const FAQS: { topic: Topic; q: string; a: string }[] = [
  { topic: 'start', q: 'Where do I find my trainings?', a: 'Open Trainings in the sidebar. Use the tabs to switch between active, upcoming and completed trainings, or search from the bar at the top.' },
  { topic: 'start', q: 'Why is the next lesson locked?', a: 'Lessons open in order. Finish the current item — watch the video to the end or reach the minimum reading time and mark it complete — and the next one unlocks.' },
  { topic: 'start', q: 'Can I download course materials?', a: 'Slide decks can be downloaded when your group is allowed to. Videos stream inside the portal only and can’t be downloaded.' },
  { topic: 'sessions', q: 'How do I join a live session?', a: 'Open the training and use “Join on Teams” when the session is live. Your attendance is recorded automatically from Teams.' },
  { topic: 'sessions', q: 'How does check-in work for in-person sessions?', a: 'Your trainer shows a QR code at the venue. Scan it with your phone to check in. Arriving after the late window marks you as late.' },
  { topic: 'sessions', q: 'I missed a session — what now?', a: 'Open the training and choose “Watch recording” if one has been shared. Talk to your trainer about attendance for the certificate.' },
  { topic: 'assessments', q: 'How many attempts do I get?', a: 'Each assessment shows its attempts, time limit and pass mark before you start. Your best score is the one that counts.' },
  { topic: 'assessments', q: 'What happens if the timer runs out?', a: 'Your answers are submitted automatically when the time limit is reached, so answer every question before time is up.' },
  { topic: 'certificates', q: 'How do I earn a certificate?', a: 'Attend the session, pass the assessment and share your feedback. When all three are done the certificate is issued automatically.' },
  { topic: 'certificates', q: 'How do I download or print my certificate?', a: 'Open Certificates, choose a certificate and use Download PDF or Print. You can also pick one of three designs first.' },
  { topic: 'certificates', q: 'How can someone check my certificate is genuine?', a: 'Every certificate has a QR code and an ID. Scanning the code opens a public page that confirms the certificate is valid.' },
]

/** Shortcuts under the search box: common questions people look for. */
const POPULAR = ['Check in', 'Locked lesson', 'Attempts', 'Download certificate']

/** Learner help centre: search, topics, user guides, FAQs and a message to the Learning & Development team. */
export function Help() {
  const { toast } = useFeedback()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<Topic | null>(null)
  const [open, setOpen] = useState<string | null>(FAQS[0].q)
  const [rated, setRated] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [about, setAbout] = useState<Topic | 'other'>('start')
  const [guide, setGuide] = useState<Guide | null>(null)

  const q = query.trim().toLowerCase()
  const words = q.split(/\s+/).filter(Boolean)
  const faqs = FAQS.filter((f) => (!topic || f.topic === topic) && words.every((w) => `${f.q} ${f.a}`.toLowerCase().includes(w)))
  const topicOf = (id: Topic) => TOPICS.find((t) => t.id === id)!

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setMessage('')
    toast('Message sent to Learning & Development — we’ll reply by email within one working day')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Help & Support</h1>

      {/* Search banner */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-[#b3302f] to-[#6e1a15] px-5 py-8 text-white sm:px-10 sm:py-10">
        <img src="/M-PESA Pattern.svg" alt="" aria-hidden className="pointer-events-none absolute -top-10 -right-16 -z-10 h-[160%] opacity-20" />
        <p className="text-sm font-medium text-white/85">Hi {user.name.split(' ')[0]},</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[1.75rem]">How can we help?</h2>
        <label className="relative mt-5 block max-w-2xl">
          <span className="sr-only">Search help articles</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, e.g. check in or certificate"
            className="w-full rounded-2xl border-0 bg-white py-3.5 pr-11 pl-12 text-sm text-zinc-900 shadow-lg shadow-black/10 outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-white/30"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/75">Popular:</span>
          {POPULAR.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuery(p)}
              className="rounded-full bg-white/15 px-3 py-1 font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Topics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {TOPICS.map((t) => {
          const active = topic === t.id
          const count = FAQS.filter((f) => f.topic === t.id).length
          return (
            <button
              key={t.id}
              onClick={() => setTopic(active ? null : t.id)}
              aria-pressed={active}
              className={cn('flex min-w-0 flex-col rounded-2xl border bg-white p-4 text-left transition sm:p-5', active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-zinc-200/80 hover:border-zinc-300')}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', t.tile)}>
                  <t.icon className="size-5" />
                </span>
                {active && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">Selected</span>}
              </span>
              <span className="mt-3 text-sm font-semibold text-zinc-900">{t.title}</span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{t.text}</span>
              <span className="mt-auto pt-3 text-[11px] font-semibold text-brand-600">
                {count} article{count === 1 ? '' : 's'}
              </span>
            </button>
          )
        })}
      </div>

      {/* User guides */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
          <BookOpenText className="size-4 text-brand-600" /> User guides
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {guides.map((g) => (
            <button key={g.id} onClick={() => setGuide(g)} className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 text-left transition hover:border-zinc-300 sm:p-5">
              <span className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <BookOpenText className="size-5" />
                </span>
                <span className="min-w-0 text-sm leading-snug font-semibold text-zinc-900 group-hover:text-brand-600">{g.title}</span>
              </span>
              <span className="mt-3 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-500">{g.summary}</span>
              <span className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                <span className="text-zinc-400">
                  {g.minutes} min read · {formatDate(g.updated, { month: 'short', day: 'numeric' })}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-600 transition group-hover:gap-1.5">
                  Read <ArrowRight className="size-3.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* FAQs */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Frequently asked questions</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {q || topic ? `${faqs.length} of ${FAQS.length} articles` : `${FAQS.length} articles`}
                {topic ? ` · ${topicOf(topic).title}` : ''}
                {q ? ` · “${query.trim()}”` : ''}
              </p>
            </div>
            {(topic || q) && (
              <button
                onClick={() => {
                  setTopic(null)
                  setQuery('')
                }}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
              >
                Show all <X className="size-3.5" />
              </button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-zinc-100">
            {faqs.map((f) => {
              const isOpen = open === f.q
              const t = topicOf(f.topic)
              return (
                <li key={f.q}>
                  <button onClick={() => setOpen(isOpen ? null : f.q)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-3.5 text-left">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', t.tile)}>
                      <t.icon className="size-4" />
                    </span>
                    <span className={cn('min-w-0 flex-1 text-sm font-medium', isOpen ? 'text-brand-700' : 'text-zinc-900')}>{f.q}</span>
                    <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition', isOpen && 'rotate-180 text-brand-600')} />
                  </button>
                  {isOpen && (
                    <div className="-mt-1 pb-4 pl-11">
                      <p className="text-sm leading-relaxed text-zinc-600">{f.a}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {rated[f.q] === undefined ? (
                          <>
                            <span className="text-zinc-500">Was this helpful?</span>
                            {[true, false].map((yes) => (
                              <button
                                key={String(yes)}
                                onClick={() => setRated((r) => ({ ...r, [f.q]: yes }))}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                              >
                                {yes ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />} {yes ? 'Yes' : 'No'}
                              </button>
                            ))}
                          </>
                        ) : rated[f.q] ? (
                          <span className="font-medium text-mpesa-700">Thanks — glad it helped.</span>
                        ) : (
                          <span className="text-zinc-600">
                            Sorry about that.{' '}
                            <button
                              onClick={() => {
                                setAbout(f.topic)
                                document.getElementById('help-message')?.focus()
                              }}
                              className="font-semibold text-brand-600 hover:underline"
                            >
                              Ask the team
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
            {!faqs.length && (
              <li>
                <EmptyState
                  compact
                  icon={Search}
                  title="No articles match"
                  text={q ? `Nothing for “${query.trim()}”. Try another word, or send us a message.` : 'No articles in this topic yet.'}
                />
              </li>
            )}
          </ul>
        </section>

        {/* Contact */}
        <aside className="space-y-4">
          <form onSubmit={send} className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <MessageSquare className="size-4 text-brand-600" /> Still need help?
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Message the Learning & Development team. We usually reply within one working day.</p>
            <label className="relative mt-4 block">
              <span className="mb-1.5 block text-xs font-semibold text-zinc-600">Topic</span>
              <select
                value={about}
                onChange={(e) => setAbout(e.target.value as Topic | 'other')}
                className="w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-white py-2.5 pr-9 pl-3 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
                <option value="other">Something else</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3 size-4 text-zinc-500" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-zinc-600">Message</span>
              <textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe the problem or question…"
                className="w-full resize-none rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <button
              type="submit"
              disabled={!message.trim()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              <Send className="size-4" /> Send message
            </button>
          </form>

          <div className="flex gap-3.5 rounded-2xl border border-zinc-200/80 bg-white p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
              <LifeBuoy className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Problem during a session?</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">Tell your trainer straight away — they can record your attendance or reopen an assessment.</p>
            </div>
          </div>
        </aside>
      </div>
      {guide && <GuideViewer guide={guide} onClose={() => setGuide(null)} />}
    </div>
  )
}

/** Reads a user guide inside the portal; Esc or the backdrop closes it. */
function GuideViewer({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null)
  useDialogFocus(panel, onClose)
  return (
    <div role="dialog" aria-modal="true" aria-label={guide.title} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <article ref={panel} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">User guide · {guide.minutes} min read</p>
            <h2 className="mt-1 text-xl leading-tight font-bold text-zinc-900">{guide.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{guide.summary}</p>
          </div>
          <button onClick={onClose} aria-label="Close guide" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-6 overflow-y-auto px-6 py-5">
          {guide.sections.map((sec, i) => (
            <section key={sec.heading}>
              <h3 className="flex items-center gap-3 text-base font-bold text-zinc-900">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                {sec.heading}
              </h3>
              <ol className="mt-3 space-y-2 pl-10">
                {sec.steps.map((step) => (
                  <li key={step} className="relative text-sm leading-relaxed text-zinc-600 before:absolute before:top-2 before:-left-4 before:size-1.5 before:rounded-full before:bg-zinc-300">
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <footer className="border-t border-zinc-100 px-6 py-3 text-xs text-zinc-400">Updated {formatDate(guide.updated)}</footer>
      </article>
    </div>
  )
}
