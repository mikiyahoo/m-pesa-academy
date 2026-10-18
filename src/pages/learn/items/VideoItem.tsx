import { Check, CheckCircle2, Play, PlayCircle, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Module } from '../../../types'
import { cn } from '../../../lib/utils'
import { Watermark, btnPrimary } from './shared'

type Props = {
  module: Module
  index: number
  total: number
  done: boolean
  canUndo: boolean
  watermark: string
  onComplete: () => void
  onUndo: () => void
}

/** Takeaways for the video: the module's slide titles when present, otherwise general points from its title. */
function learnPoints(m: Module) {
  const fromSlides = (m.slides ?? []).map((s) => s.title).slice(0, 4)
  if (fromSlides.length) return fromSlides
  const topic = m.title.toLowerCase()
  return [`Why ${topic} matters for your customers`, `Practical steps for ${topic}`, 'Real examples from M-PESA agents and merchants', 'Tips you can apply right away']
}

/**
 * Video lesson: streamed only (no download, D4) and completed automatically once
 * watched to the end (TE-3.1). Watching 90% allows marking it complete by hand.
 */
export function VideoItem({ module: m, index, total, done, canUndo, watermark, onComplete, onUndo }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [watched, setWatched] = useState(done)

  const play = () => {
    setStarted(true)
    void video.current?.play()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
        {m.video ? (
          <video
            ref={video}
            key={m.video}
            className="aspect-video w-full bg-black"
            src={m.video}
            controls={started}
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            preload="metadata"
            onContextMenu={(e) => e.preventDefault()}
            onPlay={() => setStarted(true)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration && v.currentTime / v.duration >= 0.9) setWatched(true)
            }}
            onEnded={() => {
              setWatched(true)
              if (!done) onComplete()
            }}
          />
        ) : (
          <div className="grid aspect-video place-items-center text-sm text-zinc-400">The trainer hasn't attached the video yet.</div>
        )}
        <Watermark text={watermark} dark />
        {m.video && !started && (
          <button onClick={play} aria-label={`Play ${m.title}`} className="group absolute inset-0 grid place-items-center bg-gradient-to-t from-black/50 via-black/10 to-transparent">
            <span className="grid size-20 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur transition group-hover:scale-105 group-hover:bg-brand-600 sm:size-24">
              <Play className="ml-1 size-9 fill-current sm:size-10" />
            </span>
            <span className="absolute bottom-4 left-5 text-left text-white">
              <span className="block text-xs font-medium text-white/70">Module {index + 1} of {total} • {m.minutes} min</span>
              <span className="block text-base font-semibold sm:text-lg">{m.title}</span>
            </span>
          </button>
        )}
      </div>

      {/* Details line up with the video edges. */}
      <div className="px-1">
        {/* Title on the left, completion status / action on the right. */}
        <div className="mt-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <PlayCircle className="size-4 text-brand-600" /> Video • Module {index + 1} of {total} • {m.minutes} min
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 sm:text-[1.7rem]">{m.title}</h1>
          </div>
          {done ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-mpesa-500/10 px-3.5 py-2 text-sm font-semibold text-mpesa-700">
                <CheckCircle2 className="size-4 fill-mpesa-600 text-white" /> Completed
              </span>
              {canUndo && (
                <button onClick={onUndo} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800">
                  <RotateCcw className="size-3" /> Mark as not complete
                </button>
              )}
            </div>
          ) : (
            <button onClick={watched ? onComplete : play} className={cn(btnPrimary, 'shrink-0')}>
              {watched ? (
                <>
                  <Check className="size-4" strokeWidth={3} /> Mark as complete
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" /> {started ? 'Keep watching' : 'Play video'}
                </>
              )}
            </button>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Watch to the end and this lesson completes on its own{watched && !done ? ' — or mark it complete now' : ''}. Videos stream inside the portal and can't be downloaded.
        </p>

        <div className="mt-6 flex gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 sm:p-5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mpesa-600 text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">What you'll learn</p>
            <ul className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              {learnPoints(m).map((point) => (
                <li key={point} className="flex gap-2 text-[13px] text-zinc-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-mpesa-600" strokeWidth={3} /> {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
