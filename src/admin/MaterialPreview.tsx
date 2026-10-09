import { ExternalLink, FileText, Play, Presentation } from 'lucide-react'
import type { Material } from './types'
import { Badge, Modal } from './ui'

export const materialIcon = { DOCUMENT: FileText, VIDEO: Play, PRESENTATION: Presentation, LINK: ExternalLink }

export function MaterialPreview({ material, onClose }: { material: Material | null; onClose: () => void }) {
  if (!material) return null
  return (
    <Modal open onClose={onClose} title={material.title} description={`${material.type} · ${material.minutes} mins`} wide>
      {material.type === 'VIDEO' ? (
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-zinc-900 text-white dark:bg-black">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/40 to-mpesa-600/30" />
          <button className="relative grid size-16 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg transition hover:scale-105" aria-label="Play">
            <Play className="ml-1 size-7 fill-current" />
          </button>
          <span className="absolute right-3 bottom-3 rounded bg-black/60 px-1.5 py-0.5 text-xs">{material.minutes}:00</span>
        </div>
      ) : material.type === 'PRESENTATION' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {['Overview', 'Key features', 'Tariffs & limits', 'Customer journey', 'Common issues', 'Summary'].map((s, i) => (
            <div key={s} className="flex aspect-video flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <span className="text-[10px] font-semibold text-brand-600">SLIDE {i + 1}</span>
              <span className="text-sm font-semibold text-zinc-800">{s}</span>
            </div>
          ))}
        </div>
      ) : material.type === 'LINK' ? (
        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-sm text-zinc-600">{material.description}</p>
          <a href="#" onClick={(e) => e.preventDefault()} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
            Open external resource <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : (
        <article className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-tight text-brand-600">
              m<span className="text-mpesa-500">-</span>pesa
            </span>
            <Badge>{material.type}</Badge>
          </div>
          <h3 className="mt-6 text-xl font-semibold text-zinc-900">{material.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{material.description}</p>
          <h4 className="mt-6 text-sm font-semibold text-zinc-900">Steps</h4>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>Greet the customer and confirm the service they need.</li>
            <li>Verify identity with a valid ID or Fayda number.</li>
            <li>Capture details accurately in the system.</li>
            <li>Confirm the transaction and share the reference with the customer.</li>
            <li>Remind the customer never to share their PIN.</li>
          </ol>
          <p className="mt-6 text-xs text-zinc-400">Last updated {material.updatedAt}</p>
        </article>
      )}
    </Modal>
  )
}
