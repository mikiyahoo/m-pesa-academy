import type { AdminData, Venue } from './types'

/** Starting list until an admin edits it (Admin → Venues). */
export const DEFAULT_VENUE_TYPES = ['Hall', 'Training room', 'Meeting room', 'Conference room', 'Auditorium', 'Computer lab', 'Branch / shop', 'Outdoor']

export const DEFAULT_VENUES: Venue[] = [
  { id: 'v1', name: 'Main Hall', site: 'Safaricom Ethiopia HQ', type: 'Hall', floor: 'Ground floor', capacity: 150 },
  { id: 'v2', name: 'Training Room 4B', site: 'Safaricom Ethiopia HQ', type: 'Training room', floor: '4th floor', capacity: 30 },
  { id: 'v3', name: 'Meeting Room 3A', site: 'Safaricom Ethiopia HQ', type: 'Meeting room', floor: '3rd floor', capacity: 12 },
  { id: 'v4', name: 'Boardroom', site: 'Safaricom Ethiopia HQ', type: 'Conference room', floor: '7th floor', capacity: 20 },
  { id: 'v5', name: 'Training Room 4', site: 'M-PESA Hub', type: 'Training room', capacity: 25 },
  { id: 'v6', name: 'Training Room', site: 'ISON Office', type: 'Training room', capacity: 40 },
  { id: 'v7', name: 'Conference Room', site: 'Hawassa Regional Office', type: 'Conference room', capacity: 35 },
  { id: 'v8', name: 'Training Room', site: 'Bole Retail Shop', type: 'Branch / shop', capacity: 15 },
  { id: 'v9', name: 'Branch Hall', site: 'Adama Branch', type: 'Hall', capacity: 50 },
]

export const venuesOf = (data: Pick<AdminData, 'venues'>) => data.venues ?? DEFAULT_VENUES
export const venueTypesOf = (data: Pick<AdminData, 'venueTypes'>) => data.venueTypes ?? DEFAULT_VENUE_TYPES

/** What goes into the training's location: "Training Room 4B — Safaricom Ethiopia HQ, 4th floor". */
export const venueLabel = (v: Venue) => `${v.name} — ${v.site}${v.floor ? `, ${v.floor}` : ''}`

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ')

/**
 * Closest venues first: every typed word must appear somewhere (name, site, type, floor);
 * matches at the start of a word, and in the name, rank higher.
 */
export function searchVenues(list: Venue[], query: string, limit = 8): Venue[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return list.slice(0, limit)
  const scored: { v: Venue; score: number }[] = []
  for (const v of list) {
    const name = norm(v.name)
    const all = `${name} ${norm(v.site)} ${norm(v.type)} ${norm(v.floor ?? '')}`
    let score = 0
    let ok = true
    for (const w of words) {
      if (!all.includes(w)) {
        ok = false
        break
      }
      score += new RegExp(`(^| )${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(all) ? 2 : 1
      if (name.includes(w)) score += 1
    }
    if (ok) scored.push({ v, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.v.name.localeCompare(b.v.name)).slice(0, limit).map((x) => x.v)
}
