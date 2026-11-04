import { ChevronLeft, ChevronRight, Download, Loader2, Maximize2, Minimize2, Presentation, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { useDialogFocus } from '../lib/useDialogFocus'

/**
 * In-app PowerPoint viewer. Reads the .pptx (a zip of XML) in the browser and draws each slide's
 * text boxes at their real positions and sizes. Pictures, charts and theme backgrounds aren't drawn.
 */

type Run = { text: string; size?: number; bold?: boolean }
type Para = { runs: Run[]; bullet: boolean; level: number; align?: 'l' | 'ctr' | 'r' }
type Box = { x: number; y: number; w: number; h: number; title: boolean; paras: Para[] }
type Slide = { boxes: Box[] }
type Deck = { width: number; height: number; slides: Slide[] }

const num = (v: string | null, d = 0) => (v === null ? d : Number(v))

async function parseDeck(url: string): Promise<Deck> {
  const [{ default: JSZip }, buf] = await Promise.all([import('jszip'), fetch(url).then((r) => r.arrayBuffer())])
  const zip = await JSZip.loadAsync(buf)
  const xml = async (path: string) => new DOMParser().parseFromString((await zip.file(path)?.async('string')) ?? '<x/>', 'application/xml')

  const pres = await xml('ppt/presentation.xml')
  const size = pres.getElementsByTagName('p:sldSz')[0]
  const width = num(size?.getAttribute('cx') ?? null, 12192000)
  const height = num(size?.getAttribute('cy') ?? null, 6858000)

  // Slide order comes from presentation.xml → its relationships.
  const rels = await xml('ppt/_rels/presentation.xml.rels')
  const target = new Map([...rels.getElementsByTagName('Relationship')].map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]))
  const order = [...pres.getElementsByTagName('p:sldId')].map((s) => target.get(s.getAttribute('r:id'))).filter((t): t is string => !!t)
  const paths = order.length ? order.map((t) => `ppt/${t.replace(/^\/?ppt\//, '')}`) : Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))

  const slides: Slide[] = []
  for (const path of paths) {
    const doc = await xml(path)
    const boxes: Box[] = []
    for (const sp of [...doc.getElementsByTagName('p:sp')]) {
      // Position and size come from the shape's own transform (other <a:ext> tags are extension lists).
      const xfrm = sp.getElementsByTagName('a:xfrm')[0]
      const off = xfrm?.getElementsByTagName('a:off')[0]
      const ext = [...(xfrm?.getElementsByTagName('a:ext') ?? [])].find((e) => e.hasAttribute('cx'))
      const ph = sp.getElementsByTagName('p:ph')[0]?.getAttribute('type') ?? ''
      const paras: Para[] = [...sp.getElementsByTagName('a:p')]
        .map((p) => {
          const pPr = p.getElementsByTagName('a:pPr')[0]
          const runs = [...p.getElementsByTagName('a:r')].map((r) => {
            const rPr = r.getElementsByTagName('a:rPr')[0]
            return { text: r.getElementsByTagName('a:t')[0]?.textContent ?? '', size: rPr?.getAttribute('sz') ? Number(rPr.getAttribute('sz')) / 100 : undefined, bold: rPr?.getAttribute('b') === '1' }
          })
          return { runs, bullet: !!pPr?.getElementsByTagName('a:buChar').length || !!pPr?.getElementsByTagName('a:buAutoNum').length, level: num(pPr?.getAttribute('lvl') ?? null), align: (pPr?.getAttribute('algn') as Para['align']) ?? undefined }
        })
        .filter((p) => p.runs.some((r) => r.text.trim()))
      if (!paras.length) continue
      boxes.push({
        x: off ? num(off.getAttribute('x')) / width : 0.06,
        y: off ? num(off.getAttribute('y')) / height : 0.06 + boxes.length * 0.18,
        w: ext ? num(ext.getAttribute('cx')) / width : 0.88,
        h: ext ? num(ext.getAttribute('cy')) / height : 0.16,
        title: /title|ctrTitle/i.test(ph),
        paras,
      })
    }
    slides.push({ boxes })
  }
  return { width, height, slides }
}

function SlideCanvas({ slide, deck, small = false }: { slide: Slide; deck: Deck; small?: boolean }) {
  return (
    <div className="@container relative w-full overflow-hidden bg-white" style={{ aspectRatio: `${deck.width} / ${deck.height}` }}>
      {slide.boxes.map((b, i) => (
        <div
          key={i}
          className="absolute"
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%` }}
        >
          {b.paras.map((p, j) => (
            <p
              key={j}
              className={cn('leading-tight', p.bullet && 'flex gap-[0.4em]', p.align === 'ctr' && 'justify-center text-center', p.align === 'r' && 'justify-end text-right')}
              style={{ paddingLeft: p.level ? `${p.level * 1.2}em` : undefined, marginBottom: '0.25em' }}
            >
              {p.bullet && <span className="text-brand-600">•</span>}
              <span>
                {p.runs.map((r, k) => (
                  <span
                    key={k}
                    className={cn(b.title ? 'font-bold text-zinc-900' : 'text-zinc-800', r.bold && 'font-semibold')}
                    // Point sizes are relative to a 13.33in-wide slide; scale with the slide's width.
                    style={{ fontSize: `${((r.size ?? (b.title ? 32 : 18)) / 960) * 100}cqw` }}
                  >
                    {r.text}
                  </span>
                ))}
              </span>
            </p>
          ))}
        </div>
      ))}
      {!slide.boxes.length && !small && <p className="absolute inset-0 grid place-items-center text-sm text-zinc-400">This slide has no text.</p>}
    </div>
  )
}

/** Slide viewer with previous / next, a counter and thumbnails. Arrow keys move between slides. */
/** Full-screen presentation: just the slide on black, with controls that hide after 5 s like a video player. */
function Presenter({ deck, i, go, title, onExit }: { deck: Deck; i: number; go: (n: number) => void; title?: string; onExit: () => void }) {
  const [shown, setShown] = useState(true)
  const [hovering, setHovering] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const wake = () => {
    setShown(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(false), 5000)
  }
  useEffect(() => {
    wake()
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Changing slides with the keyboard shouldn't bring the controls back.
  const visible = shown || hovering
  const count = deck.slides.length
  return (
    <div
      className={cn('relative grid h-full w-full place-items-center overflow-hidden bg-black select-none', !visible && 'cursor-none')}
      onMouseMove={wake}
      onClick={(e) => e.target === e.currentTarget && wake()}
    >
      <div className="overflow-hidden bg-white" style={{ width: `min(100vw, calc(100dvh * ${deck.width / deck.height}))` }}>
        <SlideCanvas slide={deck.slides[i]} deck={deck} />
      </div>
      {/* Hovering the bottom edge always shows the controls. */}
      <div className="absolute inset-x-0 bottom-0 h-28" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pt-10 pb-9 text-white transition-opacity duration-300 sm:px-6',
            visible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide" className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={i >= count - 1} aria-label="Next slide" className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold tabular-nums">
            {i + 1} / {count}
          </span>
          {title && <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold text-white/85 sm:block">{title}</span>}
          <span className="hidden text-xs text-white/60 lg:inline">← → to move · Esc to exit</span>
          <button type="button" onClick={onExit} aria-label="Exit full screen" title="Exit full screen (Esc)" className="ml-auto grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
            <Minimize2 className="size-5" />
          </button>
        </div>
        {/* One segment per slide; click a segment to jump to that slide. */}
        <div className={cn('absolute inset-x-0 bottom-0 flex gap-1 px-4 pb-1.5 transition-opacity sm:px-6', visible ? 'opacity-100' : 'opacity-0')}>
          {Array.from({ length: count }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => go(n - i)}
              aria-label={`Go to slide ${n + 1}`}
              aria-current={n === i ? 'step' : undefined}
              className="group h-3 min-w-0 flex-1 py-1"
            >
              <span className={cn('block h-1 w-full rounded-full transition group-hover:h-1.5', n < i ? 'bg-brand-600' : n === i ? 'bg-brand-500 ring-1 ring-white/60' : 'bg-white/25 group-hover:bg-white/45')} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PptxViewer({ url, title, globalKeys = false, onExitPresent, thumbsRight = false, navTarget }: { url: string; title?: string; globalKeys?: boolean; /** Render the previous / counter / next controls here (e.g. the player's bottom bar). */ navTarget?: HTMLElement | null; /** Set while full screen: shows only the slide, with auto-hiding controls. */ onExitPresent?: () => void; /** Thumbnails in a column beside the slide (wide screens) instead of a row below. */ thumbsRight?: boolean }) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [error, setError] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    let live = true
    parseDeck(url)
      .then((d) => live && setDeck(d))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [url])

  const count = deck?.slides.length ?? 0
  // Keep the current thumbnail in view as slides change.
  const strip = useRef<HTMLDivElement>(null)
  const firstSlide = useRef(true)
  useEffect(() => {
    // Not on first show, so opening a lesson doesn't move the page.
    if (firstSlide.current) return void (firstSlide.current = false)
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [i])
  const go = (n: number) => setI((cur) => Math.min(Math.max(cur + n, 0), Math.max(count - 1, 0)))

  // In the pop-up, arrow keys move slides wherever focus is.
  useEffect(() => {
    if (!globalKeys) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !(e.target instanceof HTMLButtonElement))) setI((cur) => Math.min(cur + 1, Math.max(count - 1, 0)))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((cur) => Math.max(cur - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [globalKeys, count])

  if (error) return <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">This presentation couldn’t be opened in the browser.</p>
  if (!deck)
    return (
      <div className="grid aspect-video place-items-center rounded-xl bg-zinc-50 text-sm text-zinc-500">
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Opening presentation…
        </span>
      </div>
    )

  const nav = (
    <div className={cn('flex items-center gap-2', navTarget ? 'justify-center' : 'justify-between', thumbsRight && 'lg:order-last')}>
          <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide" className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-zinc-600 tabular-nums">
            {!navTarget && !thumbsRight && <Presentation className="size-4 text-brand-600" />}
            {navTarget ? (
              <>
                {i + 1} / {count}
              </>
            ) : thumbsRight ? (
              <>
                <span className="lg:hidden">Slide {i + 1} of {count}</span>
                <span className="hidden lg:inline">
                  {i + 1} / {count}
                </span>
              </>
            ) : (
              <>
                Slide {i + 1} of {count}
              </>
            )}
          </span>
          <button type="button" onClick={() => go(1)} disabled={i >= count - 1} aria-label="Next slide" className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </div>
  )

  if (onExitPresent) return <Presenter deck={deck} i={i} go={go} title={title} onExit={onExitPresent} />

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (globalKeys) return
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      className={cn('outline-none', thumbsRight ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_9.5rem]' : 'space-y-3')}
      aria-label={title ? `${title} slides` : 'Slides'}
    >
      <div className={cn('overflow-hidden rounded-xl border border-zinc-200 shadow-sm', thumbsRight && 'min-w-0', globalKeys && 'mx-auto w-full')} style={globalKeys ? { maxWidth: `calc((100dvh - ${thumbsRight ? 11 : 19.5}rem) * ${deck.width / deck.height})` } : undefined}>
        <SlideCanvas slide={deck.slides[i]} deck={deck} />
      </div>
      {/* Beside the slide: controls at the top, thumbnails scrolling within the slide's height. */}
      <div className={cn('flex flex-col gap-3', thumbsRight && 'lg:min-h-0')}>
        {navTarget ? createPortal(nav, navTarget) : nav}
        <div className={cn(thumbsRight && 'relative lg:flex-1')}>
          <div ref={strip} className={cn('scrollbar-thin flex gap-2', thumbsRight ? 'overflow-x-auto pb-1 lg:absolute lg:inset-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1 lg:pb-0' : 'overflow-x-auto pb-1')}>
            {deck.slides.map((s, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Slide ${n + 1}`}
                aria-current={n === i ? 'true' : undefined}
                className={cn('w-28 shrink-0 overflow-hidden rounded-lg border-2 transition', thumbsRight && 'lg:w-full', n === i ? 'border-brand-600' : 'border-zinc-200 hover:border-zinc-300')}
              >
                <SlideCanvas slide={s} deck={deck} small />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pop-up slide viewer: dark backdrop, title bar with download and close, slides fitted to the screen. */
export function SlidesDialog({ url, title, downloadable, onClose, startFull = false }: { url: string; title: string; downloadable?: boolean; onClose: () => void; /** Open straight into full screen instead of the theater pop-up. */ startFull?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  // Full screen fills the window itself, and also asks the browser for real full screen when allowed.
  const [full, setFull] = useState(startFull)
  const fullRef = useRef(false)
  fullRef.current = full
  const exitFull = () => {
    setFull(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  // Esc leaves full screen first; a second Esc closes the slides.
  useDialogFocus(panel, () => (fullRef.current ? exitFull() : onClose()))
  useEffect(() => {
    // Leaving the browser's full screen (e.g. its own Esc) also leaves ours.
    const sync = () => {
      if (!document.fullscreenElement) setFull(false)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])
  // Opened from "Full screen": ask the browser for real full screen right away (still within the click).
  useEffect(() => {
    if (startFull) void panel.current?.requestFullscreen?.().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggleFull = () => {
    if (full) return exitFull()
    setFull(true)
    void panel.current?.requestFullscreen?.().catch(() => {})
  }
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex justify-center', full ? 'items-stretch' : 'items-end sm:items-center sm:p-6')}>
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal aria-label={`${title} slides`} className={cn('relative flex w-full flex-col overflow-hidden shadow-2xl', full ? 'h-full max-h-none max-w-none rounded-none bg-black' : 'max-h-[100dvh] max-w-6xl rounded-t-3xl bg-white sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl lg:max-w-[min(100%,92rem)]')}>
        <header className={cn('flex items-center gap-3 border-b border-zinc-100 px-4 py-3 sm:px-6', full && 'hidden')}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Presentation className="size-4" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-zinc-900">{title}</h2>
          <button
            type="button"
            onClick={toggleFull}
            aria-label={full ? 'Exit full screen' : 'Full screen'}
            title={full ? 'Exit full screen' : 'Full screen'}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-2.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:px-3"
          >
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="hidden sm:inline">{full ? 'Exit full screen' : 'Full screen'}</span>
          </button>
          {downloadable && (
            <a href={url} download className="hidden items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:inline-flex">
              <Download className="size-3.5" /> Download slides
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Close slides" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
            <X className="size-5" />
          </button>
        </header>
        <div className={cn('min-h-0 flex-1', full ? 'overflow-hidden' : 'scrollbar-thin overflow-y-auto bg-zinc-50/60 p-4 sm:p-6')}>
          <PptxViewer url={url} title={title} globalKeys thumbsRight onExitPresent={full ? exitFull : undefined} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
