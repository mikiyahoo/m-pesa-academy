import { Check, CheckCircle2, Download, FileText, Maximize2, RectangleHorizontal, RotateCcw, Timer } from "lucide-react";
import { PptxViewer, SlidesDialog } from "../../../components/PptxViewer";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { canDownload, DOCUMENT_MIN_SECONDS } from "../../../data/trainings";
import { cn } from "../../../lib/utils";
import type { Module } from "../../../types";
import { Watermark, btnPrimary, clock } from "./shared";

type Props = {
  module: Module;
  index: number;
  total: number;
  done: boolean;
  canUndo: boolean;
  watermark: string;
  onComplete: () => void;
  onUndo: () => void;
};

/** Takeaways: the document's section titles when present, otherwise general points from its title. */
function learnPoints(m: Module) {
  const fromSlides = (m.slides ?? []).map((s) => s.title).slice(0, 4);
  if (fromSlides.length) return fromSlides;
  const topic = m.title.toLowerCase();
  return [`Why ${topic} matters for your customers`, `Practical steps for ${topic}`, "Real examples from M-PESA agents and merchants", "Tips you can apply right away"];
}

/**
 * Document lesson, laid out like a video: the material opens straight away at the top, with the
 * title, completion and description below. A minimum reading time must pass before it can be
 * marked complete (TE-3.1); the source deck stays downloadable where allowed (D4).
 */
export function ReadingItem({ module: m, index, total, done, canUndo, watermark, onComplete, onUndo }: Props) {
  const [elapsed, setElapsed] = useState(0);
  // Theater: large pop-up over the page. Full screen: the slides fill the screen.
  const [showDeck, setShowDeck] = useState<false | "theater" | "full">(false);
  const slides = m.slides ?? [];

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setElapsed((e) => Math.min(e + 1, DOCUMENT_MIN_SECONDS)), 1000);
    return () => window.clearInterval(t);
  }, [done]);

  // The course player's bottom bar has a slot for lesson tools.
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);
  const [navEl, setNavEl] = useState<HTMLSpanElement | null>(null);
  useEffect(() => setFooterSlot(document.getElementById("player-footer-tools")), []);

  const ready = done || elapsed >= DOCUMENT_MIN_SECONDS;
  const pct = done ? 100 : (elapsed / DOCUMENT_MIN_SECONDS) * 100;

  const tools = m.deck && (
        <>
          <button type="button" onClick={() => setShowDeck("theater")} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
            <RectangleHorizontal className="size-3.5" /> Theater mode
          </button>
          <button type="button" onClick={() => setShowDeck("full")} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
            <Maximize2 className="size-3.5" /> Full screen
          </button>
          {canDownload(m) ? (
            <a href={m.deck} download className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50">
              <Download className="size-3.5" /> Download slides
            </a>
          ) : (
            <span className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500">View only</span>
          )}
          {/* Slide controls at the end, from the viewer. */}
          <span ref={setNavEl} className="flex items-center empty:hidden" />
        </>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {/* The material itself, first — no extra click to open it. */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        {m.deck ? (
          <div className="p-3 sm:p-4">
            <PptxViewer url={m.deck} title={m.title} thumbsRight navTarget={footerSlot ? navEl : null} />
          </div>
        ) : slides.length ? (
          <div className="scrollbar-thin max-h-[70vh] overflow-y-auto bg-zinc-100/70 p-3 sm:p-6">
            <div className="mx-auto max-w-3xl rounded-xl bg-white px-6 py-8 text-[15px] leading-relaxed text-zinc-700 shadow-sm ring-1 ring-zinc-200/70 sm:px-12 sm:py-12">
              <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Document</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{m.title}</h2>
              <div className="mt-8 space-y-8">
                {slides.map((s, i) => (
                  <section key={s.title} className={cn(i > 0 && "border-t border-zinc-100 pt-8")}>
                    <h3 className="flex items-center gap-3 text-lg font-bold text-zinc-900">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex gap-3">
                          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-400" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid aspect-video place-items-center text-sm text-zinc-500">The trainer hasn't attached the document yet.</div>
        )}
        <Watermark text={watermark} />
      </div>

      {/* In the player's bottom bar when it's there; otherwise under the slides. */}
      {tools && (footerSlot ? createPortal(tools, footerSlot) : <div className="mt-3 flex flex-wrap items-center justify-end gap-2 px-1">{tools}</div>)}
      {m.deck && showDeck && <SlidesDialog url={m.deck} title={m.title} downloadable={canDownload(m)} onClose={() => setShowDeck(false)} startFull={showDeck === "full"} />}

      {/* Details line up with the viewer edges, same as the video lesson. */}
      <div className="px-1">
        <div className="mt-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <FileText className="size-4 text-brand-600" /> {m.deck ? "Presentation" : "Document"} • Module {index + 1} of {total} • {m.minutes} min
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
            <button onClick={onComplete} disabled={!ready} className={cn(btnPrimary, "shrink-0")}>
              {ready ? <Check className="size-4" strokeWidth={3} /> : <Timer className="size-4" />}
              {ready ? "Mark as complete" : `Complete in ${clock(DOCUMENT_MIN_SECONDS - elapsed)}`}
            </button>
          )}
        </div>

        {!done && (
          <div className="mt-4 flex max-w-2xl items-center gap-3">
            <span className="relative h-1.5 flex-1 rounded-full bg-zinc-200">
              <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear", ready ? "bg-mpesa-600" : "bg-brand-600")} style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 text-xs font-semibold text-zinc-600 tabular-nums">
              {clock(elapsed)} / {clock(DOCUMENT_MIN_SECONDS)}
            </span>
          </div>
        )}

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Read through the {m.deck ? "slides" : "document"} above. After {clock(DOCUMENT_MIN_SECONDS)} of reading you can mark it complete to unlock the next lesson.
          {m.deck && !canDownload(m) ? " This file can be viewed in the portal only." : ""}
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
  );
}
