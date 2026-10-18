import { toPng } from 'html-to-image'

/**
 * Certificate export. The on-screen certificate is rasterised once, so the print and
 * the PDF look exactly like the preview (fonts, red backgrounds, QR) regardless of the
 * browser's "background graphics" setting or the page layout around it.
 */
async function snapshot(node: HTMLElement) {
  await document.fonts?.ready
  return toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: '#ffffff' })
}

async function imageSize(src: string) {
  const img = new Image()
  img.src = src
  await img.decode()
  return { w: img.naturalWidth, h: img.naturalHeight }
}

/** Downloads the certificate as an A4 landscape PDF file. */
export async function downloadCertificatePdf(node: HTMLElement, fileName: string) {
  const [png, { jsPDF }] = await Promise.all([snapshot(node), import('jspdf')])
  const { w, h } = await imageSize(png)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 8
  const scale = Math.min((pageW - margin * 2) / w, (pageH - margin * 2) / h)
  const drawW = w * scale
  const drawH = h * scale
  pdf.addImage(png, 'PNG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH)
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}

/** Prints only the certificate, from a hidden frame, on one landscape page. */
export async function printCertificate(node: HTMLElement) {
  const png = await snapshot(node)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return
  }
  doc.open()
  doc.write(`<!doctype html><html><head><title>Certificate</title><style>
    @page { size: A4 landscape; margin: 8mm; }
    html, body { margin: 0; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style></head><body><img alt="Certificate" src="${png}"></body></html>`)
  doc.close()
  await doc.images[0]?.decode().catch(() => undefined)
  const cleanup = () => setTimeout(() => frame.remove(), 500)
  win.addEventListener('afterprint', cleanup, { once: true })
  win.focus()
  win.print()
  // Some browsers never fire afterprint for iframes; remove the frame anyway.
  setTimeout(cleanup, 60_000)
}
