import { useEffect, useState } from 'react'
import type { Training } from '../types'

const OFFLINE_INDEX_KEY = 'mpesa-learning:offline-courses-index'
const OFFLINE_PREFIX = 'mpesa-learning:offline-course:'
const OFFLINE_SYNC_KEY = 'mpesa-learning:offline-pending-sync'

export type OfflineSyncAction =
  | { type: 'completeModule'; trainingId: string; moduleId: string; timestamp: string }
  | { type: 'submitQuiz'; trainingId: string; score: number; timestamp: string }
  | { type: 'submitFeedback'; trainingId: string; feedback: any; timestamp: string }

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration is non-fatal
      })
    })
  }
}

export function listOfflineCourseIds(): string[] {
  try {
    const raw = localStorage.getItem(OFFLINE_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function isCourseOffline(trainingId: string): boolean {
  return listOfflineCourseIds().includes(trainingId)
}

export function saveCourseOffline(training: Training): { success: boolean; bytes: number } {
  try {
    const serialized = JSON.stringify(training)
    localStorage.setItem(`${OFFLINE_PREFIX}${training.id}`, serialized)

    const index = listOfflineCourseIds()
    if (!index.includes(training.id)) {
      index.push(training.id)
      localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(index))
    }

    return { success: true, bytes: serialized.length }
  } catch {
    return { success: false, bytes: 0 }
  }
}

export function removeCourseOffline(trainingId: string): void {
  try {
    localStorage.removeItem(`${OFFLINE_PREFIX}${trainingId}`)
    const index = listOfflineCourseIds().filter((id) => id !== trainingId)
    localStorage.setItem(OFFLINE_INDEX_KEY, JSON.stringify(index))
  } catch {
    // Local storage fallback
  }
}

export function getOfflineCourse(trainingId: string): Training | null {
  try {
    const raw = localStorage.getItem(`${OFFLINE_PREFIX}${trainingId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getOfflineStorageEstimate(): { count: number; estimatedKb: number } {
  const ids = listOfflineCourseIds()
  let totalChars = 0
  ids.forEach((id) => {
    const content = localStorage.getItem(`${OFFLINE_PREFIX}${id}`)
    if (content) totalChars += content.length
  })
  return {
    count: ids.length,
    estimatedKb: Math.round(totalChars / 1024),
  }
}

export function queueOfflineSyncAction(action: OfflineSyncAction): void {
  try {
    const current: OfflineSyncAction[] = JSON.parse(localStorage.getItem(OFFLINE_SYNC_KEY) ?? '[]')
    current.push(action)
    localStorage.setItem(OFFLINE_SYNC_KEY, JSON.stringify(current))
  } catch {
    // Sync queue fallback
  }
}

export function getPendingOfflineSyncCount(): number {
  try {
    const current = JSON.parse(localStorage.getItem(OFFLINE_SYNC_KEY) ?? '[]')
    return current.length
  } catch {
    return 0
  }
}

export function processPendingOfflineSync(
  handler: (action: OfflineSyncAction) => void,
): number {
  try {
    const current: OfflineSyncAction[] = JSON.parse(localStorage.getItem(OFFLINE_SYNC_KEY) ?? '[]')
    if (current.length === 0) return 0

    current.forEach((action) => handler(action))
    localStorage.removeItem(OFFLINE_SYNC_KEY)
    return current.length
  } catch {
    return 0
  }
}

/** React hook for tracking online/offline status and detecting reconnection events */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [reconnected, setReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setReconnected(true)
      const t = setTimeout(() => setReconnected(false), 4000)
      return () => clearTimeout(t)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, reconnected }
}
