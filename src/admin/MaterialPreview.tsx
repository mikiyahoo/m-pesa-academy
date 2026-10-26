import { Download, ExternalLink, FileText, Play, Presentation, ShieldCheck } from 'lucide-react'
import { useFeedback } from '../components/Feedback'
import { Watermark } from '../pages/learn/items/shared'
import { useAuth } from '../store/Auth'
import { todayISO } from '../lib/utils'
import { videoSource } from './embeds'
import { PptxViewer } from '../components/PptxViewer'
import { countDownload, downloadMaterial, materialFileName } from './materialFiles'
import { MaterialAttachmentPreview } from './MaterialAttachmentPreview'
import { useAdmin } from './store'
import type { Material } from './types'
import { Badge, Button, Modal } from './ui'

export const materialIcon = { DOCUMENT: FileText, VIDEO: Play, PRESENTATION: Presentation, LINK: ExternalLink }

export function MaterialPreview({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const { user } = useAuth()
  if (!material) return null
  const video = videoSource(material.url)
  const watermark = user.name + ' • ' + todayISO()

  // Videos always stream; documents/presentations are downloadable only by the toggled groups (D4).
  const downloadable = (material.type === 'DOCUMENT' || material.type === 'PRESENTATION') && material.downloadableGroupIds.length > 0
  const groupNames = material.downloadableGroupIds.map((id) => data.groups.find((g) => g.id === id)?.name).filter(Boolean)

  return (
    <Modal open onClose={onClose} title={material.title} description={`${material.type} · ${material.minutes} mins · version ${material.version}`} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
        <ShieldCheck className="size-3.5" />
        <span>Protected material · M-PESA Training Portal</span>
        {downloadable ? (
          <span className="text-mpesa-700">· Downloadable by: {groupNames.join(', ')}</span>
        ) : material.type === 'VIDEO' ? (
          <span>· Stream only — downloads disabled</span>
        ) : (
          <span>· No download groups selected</span>
        )}
      </div>
      {material.type === 'VIDEO' && video.kind !== 'none' ? (
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black" onContextMenu={(e) => e.preventDefault()}>
          {video.kind === 'file' ? (
            <video src={video.src} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline preload="metadata" className="size-full" />
          ) : (
            <iframe
              src={video.src}
              title={material.title}
              className="size-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          )}
          <Watermark text={watermark} dark />
          <span className="pointer-events-none absolute top-3 left-3 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{video.label} · stream only</span>
        </div>
      ) : material.type === 'VIDEO' ? (
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl bg-zinc-900 text-white dark:bg-black">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/40 to-mpesa-600/30" />
          <button className="relative grid size-16 place-items-center rounded-full bg-white/90 text-brand-600 shadow-lg transition hover:scale-105" aria-label="Play">
            <Play className="ml-1 size-7 fill-current" />
          </button>
          <span className="absolute right-3 bottom-3 rounded bg-black/60 px-1.5 py-0.5 text-xs">{material.minutes}:00</span>
        </div>
      ) : material.type === 'PRESENTATION' ? (
        material.fileId ? (
          <MaterialAttachmentPreview type={material.type} title={material.title} fileId={material.fileId} fileName={material.fileName} fileSize={material.fileSize} />
        ) : (
          <PptxViewer url="/trainings/Sample Training.pptx" title={material.title} />
        )
      ) : material.type === 'LINK' ? (
        <div className="rounded-2xl border border-zinc-200/80 p-5">
          <p className="text-sm text-zinc-600">{material.description}</p>
          <a href={material.url ?? '#'} onClick={(e) => e.preventDefault()} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
            Open external resource <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : material.fileId ? (
        <MaterialAttachmentPreview type={material.type} title={material.title} fileId={material.fileId} fileName={material.fileName} fileSize={material.fileSize} />
      ) : (
        <article className="mx-auto max-w-2xl rounded-xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-tight text-brand-600">
              m<span className="text-mpesa-500">-</span>pesa
            </span>
            <Badge>{material.type}</Badge>
          </div>
          <h3 className="mt-6 text-xl font-bold text-zinc-900">{material.title}</h3>
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
      {(downloadable || material.type === 'DOCUMENT' || material.type === 'PRESENTATION') && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-3">
          <span className="text-xs text-zinc-500">
            {downloadable
              ? `Trainee downloads permitted for: ${groupNames.join(', ')}`
              : 'Admin access: direct download of the attached file'}
          </span>
          <Button
            size="sm"
            onClick={async () => {
              if (!(await downloadMaterial(material))) return
              update((d) => countDownload(d, material.id), { action: 'Downloaded material', target: material.title, silent: true })
              toast(`Downloaded ${materialFileName(material)}`)
            }}
          >
            <Download className="size-3.5" /> Download file
          </Button>
        </div>
      )}
    </Modal>
  )
}
