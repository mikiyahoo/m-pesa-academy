import { utils, writeFile } from 'xlsx'
import { downloadCsv } from '../ui'

export type Sheet = { name: string; header: string[]; rows: (string | number)[][] }

/** Real Excel workbook, one tab per sheet (D03, T07). Write-only: no files are ever parsed. */
export function exportXlsx(filename: string, sheets: Sheet[]) {
  const wb = utils.book_new()
  for (const s of sheets) {
    const ws = utils.aoa_to_sheet([s.header, ...s.rows])
    ws['!cols'] = s.header.map((h, i) => ({ wch: Math.min(48, Math.max(h.length, ...s.rows.map((r) => String(r[i] ?? '').length)) + 2) }))
    utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function exportCsv(filename: string, sheet: Sheet) {
  downloadCsv(filename.endsWith('.csv') ? filename : `${filename}.csv`, sheet.header, sheet.rows)
}

/** PDF through the browser's print dialog; print styles hide the app shell (see index.css). */
export function printReport(title: string) {
  const prev = document.title
  document.title = title
  window.print()
  document.title = prev
}
