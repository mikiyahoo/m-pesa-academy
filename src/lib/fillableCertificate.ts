export const CERTIFICATE_PDF_FIELDS = ['user.name', 'user.email', 'training.title', 'date.now', 'certificate.code'] as const

export type CertificatePdfValues = {
  name: string
  email: string
  training: string
  date: string
  code: string
}

const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Read a small fillable PDF and check that it contains the required named text fields. */
export async function inspectCertificatePdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a PDF file.')
  }
  if (!file.size) throw new Error('The selected PDF is empty.')
  if (file.size > MAX_TEMPLATE_BYTES) throw new Error('Keep the PDF template under 2 MB so it can be stored with the admin data.')

  const { PDFDocument } = await import('pdf-lib')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const document = await PDFDocument.load(bytes)
  const form = document.getForm()
  const names = new Set(form.getFields().map((field) => field.getName()))
  const missing = CERTIFICATE_PDF_FIELDS.filter((name) => !names.has(name))
  if (missing.length) throw new Error(`Add these fillable text fields to the PDF: ${missing.join(', ')}`)

  for (const name of CERTIFICATE_PDF_FIELDS) {
    try {
      form.getTextField(name)
    } catch {
      throw new Error(`“${name}” must be a fillable text field.`)
    }
  }

  return { data: bytesToBase64(bytes), fileName: file.name, size: file.size }
}

/** Fill the imported AcroForm fields and return the resulting PDF bytes. */
export async function fillCertificatePdf(templateData: string, values: CertificatePdfValues) {
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.load(base64ToBytes(templateData))
  const form = document.getForm()
  form.getTextField('user.name').setText(values.name)
  form.getTextField('user.email').setText(values.email)
  form.getTextField('training.title').setText(values.training)
  form.getTextField('date.now').setText(values.date)
  form.getTextField('certificate.code').setText(values.code)
  return document.save()
}

function pdfBlob(bytes: Uint8Array) {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' })
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(pdfBlob(bytes))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function printPdfBytes(bytes: Uint8Array) {
  const url = URL.createObjectURL(pdfBlob(bytes))
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  frame.src = url
  document.body.appendChild(frame)
}
