import { parseDate } from '../lib/utils'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** "October 8th, 2026" */
export const longDate = (iso: string) => {
  const d = parseDate(iso)
  return `${d.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(d.getDate())}, ${d.getFullYear()}`
}

/** "Oct 8, 2026" */
export const shortDate = (iso: string) => parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "9:00 AM" */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export const dateTime = (isoDateTime: string) =>
  new Date(isoDateTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
