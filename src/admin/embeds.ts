/**
 * Streaming sources for video materials (C08, URS 5 "link only"). Embeds use the providers'
 * own players, so nothing is downloaded into the portal.
 */
export type VideoSource =
  | { kind: 'youtube' | 'vimeo' | 'sharepoint'; src: string; label: string }
  | { kind: 'file'; src: string; label: string }
  | { kind: 'none' }

export function videoSource(url?: string): VideoSource {
  const u = url?.trim()
  if (!u) return { kind: 'none' }
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`, label: 'YouTube' }
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`, label: 'Vimeo' }
  if (/sharepoint\.com|microsoftstream\.com/i.test(u)) {
    // SharePoint / Stream share links play inside the embed page.
    const src = /embed\.aspx/i.test(u) ? u : u.includes('?') ? `${u}&embed=1` : `${u}?embed=1`
    return { kind: 'sharepoint', src, label: 'SharePoint / Stream' }
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u) || u.startsWith('/')) return { kind: 'file', src: u, label: 'Streamed file' }
  return { kind: 'none' }
}
