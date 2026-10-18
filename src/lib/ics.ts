import type { Training } from '../types'

/** Downloads a calendar invite (.ics) for a training session. */
export function downloadIcs(t: Training) {
  const stamp = (time: string) => `${t.date.replaceAll('-', '')}T${time.replace(':', '')}00`
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//M-PESA Academy//EN',
    'BEGIN:VEVENT',
    `UID:${t.id}@mpesa-learning`,
    `DTSTART:${stamp(t.startTime)}`,
    `DTEND:${stamp(t.endTime)}`,
    `SUMMARY:${t.title}`,
    `LOCATION:${t.venue}`,
    `DESCRIPTION:Trainer: ${t.trainer}${t.teamsJoinUrl ? `\nJoin on Microsoft Teams: ${t.teamsJoinUrl}` : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${t.id}.ics` })
  a.click()
  URL.revokeObjectURL(url)
}
