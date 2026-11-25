import { LoaderCircle } from 'lucide-react'
import { useStoredFileUrl } from './materialFiles'

/** Plays a video uploaded from a computer (kept in this browser): stream only, no download or picture-in-picture. */
export function StoredVideo({ fileId, file, className }: { fileId?: string; file?: File | null; className?: string }) {
  const { url, loading, error } = useStoredFileUrl(fileId, file)
  if (url) return <video src={url} controls controlsList="nodownload noplaybackrate" disablePictureInPicture playsInline preload="metadata" onContextMenu={(e) => e.preventDefault()} className={className ?? 'size-full'} />
  return (
    <div className="grid size-full place-items-center text-sm text-zinc-400">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Loading video…
        </span>
      ) : error ? (
        'The uploaded video could not be found in this browser.'
      ) : (
        'No video attached.'
      )}
    </div>
  )
}
