import { ChevronLeft, ChevronRight, Download, Loader2, Presentation, X } from 'lucide-react'
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
export function PptxViewer({ url, title, globalKeys = false }: { url: string; title?: string; globalKeys?: boolean }) {
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
  const go = (n: number) => setI((cur) => Math.min(Math.max(cur + n, 0), Math.max(count - 1, 0)))

  // In the pop-up, arrow keys move slides wherever focus is.
  useEffect(() => {
    if (!globalKeys) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((cur) => Math.min(cur + 1, Math.max(count - 1, 0)))
      if (e.key === 'ArrowLeft') setI((cur) => Math.max(cur - 1, 0))
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

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (globalKeys) return
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      className="space-y-3 outline-none"
      aria-label={title ? `${title} slides` : 'Slides'}
    >
      <div className={cn('overflow-hidden rounded-xl border border-zinc-200 shadow-sm', globalKeys && 'mx-auto')} style={globalKeys ? { maxWidth: `calc((100dvh - 19.5rem) * ${deck.width / deck.height})` } : undefined}>
        <SlideCanvas slide={deck.slides[i]} deck={deck} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide" className="grid size-9 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 tabular-nums">
          <Presentation className="size-4 text-brand-600" /> Slide {i + 1} of {count}
        </span>
        <button type="button" onClick={() => go(1)} disabled={i >= count - 1} aria-label="Next slide" className="grid size-9 place-items-center rounded-full border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
        {deck.slides.map((s, n) => (
          <button
            key={n}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Slide ${n + 1}`}
            aria-current={n === i ? 'true' : undefined}
            className={cn('w-28 shrink-0 overflow-hidden rounded-lg border-2 transition', n === i ? 'border-brand-600' : 'border-zinc-200 hover:border-zinc-300')}
          >
            <SlideCanvas slide={s} deck={deck} small />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Pop-up slide viewer: dark backdrop, title bar with download and close, slides fitted to the screen. */
export function SlidesDialog({ url, title, downloadable, onClose }: { url: string; title: string; downloadable?: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useDialogFocus(panel, onClose)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal aria-label={`${title} slides`} className="relative flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 sm:px-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Presentation className="size-4" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-zinc-900">{title}</h2>
          {downloadable && (
            <a href={url} download className="hidden items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:inline-flex">
              <Download className="size-3.5" /> Download
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="Close slides" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
            <X className="size-5" />
          </button>
        </header>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-zinc-50/60 p-4 sm:p-6">
          <PptxViewer url={url} title={title} globalKeys />
        </div>
      </div>
    </div>,
    document.body,
  )
}
