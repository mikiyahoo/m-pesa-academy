import { useSyncExternalStore } from 'react'

/**
 * Profile photos people upload for themselves, kept in this browser (the prototype has no backend).
 * Keyed by name, like the demo avatars, so every place that shows the person picks the photo up.
 */
const KEY = 'mpesa-learning:profile-photos:v1'
const EVENT = 'mpesa-learning:profile-photos'
export const PHOTO_MAX_MB = 8

const read = (): string => {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
const parse = (raw: string): Record<string, string> => {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}
const keyOf = (name: string) => name.trim().toLowerCase()

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** The uploaded photo for this person, if they have one. */
export function usePhoto(name: string): string | undefined {
  const raw = useSyncExternalStore(subscribe, read, () => '')
  return parse(raw)[keyOf(name)]
}

function write(map: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(map))
  window.dispatchEvent(new Event(EVENT))
}

export function removePhoto(name: string) {
  const map = parse(read())
  delete map[keyOf(name)]
  write(map)
}

/** Centre-crops to a square and shrinks it so it stays small enough to keep in the browser. */
export async function savePhoto(name: string, file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).')
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) throw new Error(`Choose a photo under ${PHOTO_MAX_MB} MB.`)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That image could not be read. Try a JPG or PNG.'))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const size = Math.min(320, side)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser could not process the image.')
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    const map = parse(read())
    map[keyOf(name)] = canvas.toDataURL('image/jpeg', 0.86)
    try {
      write(map)
    } catch {
      throw new Error('There isn’t enough browser storage left for the photo.')
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
