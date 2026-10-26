import { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  isCourseOffline,
  removeCourseOffline,
  saveCourseOffline,
  useNetworkStatus,
} from '../lib/offlineManager'
import type { Training } from '../types'
import { useFeedback } from './Feedback'
import { cn } from '../lib/utils'

export function OfflineCourseToggle({
  training,
  compact = false,
}: {
  training: Training
  compact?: boolean
}) {
  const { toast } = useFeedback()
  const [downloaded, setDownloaded] = useState(() => isCourseOffline(training.id))
  const [downloading, setDownloading] = useState(false)

  const handleToggle = () => {
    if (downloaded) {
      removeCourseOffline(training.id)
      setDownloaded(false)
      toast(`"${training.title}" removed from offline storage`, { tone: 'info' })
    } else {
      setDownloading(true)
      setTimeout(() => {
        const { bytes } = saveCourseOffline(training)
        setDownloaded(true)
        setDownloading(false)
        const kb = Math.round(bytes / 1024)
        toast(`"${training.title}" downloaded (${kb} KB). You can study and complete this course offline!`, {
          tone: 'success',
        })
      }, 400)
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={downloading}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
          downloaded
            ? 'bg-mpesa-50 text-mpesa-700 hover:bg-mpesa-100 ring-1 ring-mpesa-200'
            : 'text-zinc-600 hover:bg-zinc-100',
        )}
        title={downloaded ? 'Saved for offline reading (click to remove)' : 'Download course for offline access'}
      >
        {downloading ? (
          <RefreshCw className="size-3.5 animate-spin text-brand-600" />
        ) : downloaded ? (
          <CheckCircle2 className="size-3.5 text-mpesa-600" />
        ) : (
          <Download className="size-3.5" />
        )}
        <span className="hidden sm:inline">
          {downloading ? 'Downloading…' : downloaded ? 'Offline Ready' : 'Download'}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            downloaded ? 'bg-mpesa-50 text-mpesa-600' : 'bg-zinc-200 text-zinc-600',
          )}
        >
          {downloaded ? <HardDrive className="size-5" /> : <Download className="size-5" />}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-zinc-900">
              {downloaded ? 'Available Offline' : 'Offline Access'}
            </h4>
            {downloaded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mpesa-100 px-2 py-0.5 text-[11px] font-bold text-mpesa-800">
                <Check className="size-3" />
                Cached
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {downloaded
              ? 'Course materials, reading slides, and quiz questions are saved on this device.'
              : 'Download course content to continue learning without internet or during network drops.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {downloaded ? (
          <button
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-red-600 transition"
          >
            <Trash2 className="size-3.5" />
            Remove Offline Copy
          </button>
        ) : (
          <button
            onClick={handleToggle}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-xs shadow-brand-600/25 hover:bg-brand-700 transition"
          >
            {downloading ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {downloading ? 'Downloading…' : 'Download for Offline'}
          </button>
        )}
      </div>
    </div>
  )
}

/** Global Offline Banner alerting learners when they are offline or when syncing occurs */
export function OfflineNetworkBanner() {
  const { isOnline, reconnected } = useNetworkStatus()

  if (reconnected) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-mpesa-600 px-4 py-2 text-xs font-semibold text-white shadow-md animate-in slide-in-from-top duration-300">
        <Wifi className="size-4" />
        <span>Connected — Your learning progress is automatically synchronized with the academy.</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-zinc-900 px-4 py-2.5 text-xs text-white shadow-md">
        <div className="flex items-center gap-2">
          <WifiOff className="size-4 text-amber-400" />
          <span>
            <strong className="font-bold text-amber-400">Offline Mode Active:</strong> You are currently disconnected. Downloaded courses can still be studied; progress will sync when reconnected.
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
          PWA Offline
        </span>
      </div>
    )
  }

  return null
}
