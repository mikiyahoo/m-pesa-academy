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

/** First rows of every export: what the report is, when it was made and which filters were on (US39). */
export function reportInfoSheet(title: string, filters: string): Sheet {
  return {
    name: 'Report info',
    header: ['Report', title],
    rows: [
      ['Generated', new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })],
      ['Filters', filters || 'None (all trainings)'],
    ],
  }
}

/** A real PDF file (US38): title, generation date and filters, then each sheet as a table. Landscape A4, wraps onto new pages. */
export async function exportPdf(filename: string, title: string, filters: string, sheets: Sheet[]) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 12
  let y = M
  const newPage = () => {
    pdf.addPage()
    y = M
  }
  pdf.setFont('helvetica', 'bold').setFontSize(16).setTextColor(24, 24, 27)
  pdf.text(title, M, y + 4)
  y += 10
  pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(113, 113, 122)
  pdf.text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, M, y)
  y += 5
  pdf.text(pdf.splitTextToSize(`Filters: ${filters || 'None (all trainings)'}`, W - 2 * M), M, y)
  y += 8

  for (const s of sheets) {
    if (y > H - 30) newPage()
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(208, 60, 59)
    pdf.text(s.name, M, y)
    y += 5
    // Column widths follow the longest value in each column, scaled to the page.
    const lens = s.header.map((h, i) => Math.min(40, Math.max(h.length, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? '').length), 4)))
    const total = lens.reduce((a, b) => a + b, 0)
    const widths = lens.map((l) => ((W - 2 * M) * l) / total)
    const row = (cells: (string | number)[], bold: boolean) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(8)
      const wrapped = cells.map((c, i) => pdf.splitTextToSize(String(c ?? ''), widths[i] - 2) as string[])
      const h = Math.max(...wrapped.map((w) => w.length)) * 3.6 + 2
      if (y + h > H - M) {
        newPage()
        if (!bold) row(s.header, true)
      }
      if (bold) {
        pdf.setFillColor(244, 244, 245)
        pdf.rect(M, y - 3.2, W - 2 * M, h, 'F')
      }
      pdf.setTextColor(bold ? 63 : 39, bold ? 63 : 39, bold ? 70 : 42)
      let x = M
      wrapped.forEach((lines, i) => {
        pdf.text(lines, x + 1, y)
        x += widths[i]
      })
      y += h
      pdf.setDrawColor(228, 228, 231)
      pdf.line(M, y - 3.2, W - M, y - 3.2)
    }
    row(s.header, true)
    if (!s.rows.length) {
      pdf.setFont('helvetica', 'italic').setFontSize(8).setTextColor(113, 113, 122)
      pdf.text('No rows for these filters.', M + 1, y)
      y += 5
    }
    s.rows.forEach((r) => row(r, false))
    y += 6
  }
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(161, 161, 170)
    pdf.text(`M-PESA Academy · page ${i} of ${pages}`, W - M, H - 6, { align: 'right' })
  }
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/** PDF through the browser's print dialog; print styles hide the app shell (see index.css). */
export function printReport(title: string) {
  const prev = document.title
  document.title = title
  window.print()
  document.title = prev
}
