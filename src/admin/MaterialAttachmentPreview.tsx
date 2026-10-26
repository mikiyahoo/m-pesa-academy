import { Download, FileText, LoaderCircle, Presentation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatBytes, getMaterialFile } from './materialFiles'
import { PptxViewer } from '../components/PptxViewer'
import type { MaterialType } from './types'

type Attachment = { blob: Blob; name: string; size: number; url: string }

export function MaterialAttachmentPreview({
  type,
  title,
  file,
  fileId,
  fileName,
  fileSize,
}: {
  type: MaterialType
  title: string
  file?: File | null
  fileId?: string
  fileName?: string
  fileSize?: number
}) {
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setAttachment(null)
    setError(false)
    setLoading(!!file || !!fileId)

    const load = async () => {
      if (!file && !fileId) return
      try {
        const stored = file ? { blob: file, name: file.name } : await getMaterialFile(fileId!)
        if (!active) return
        if (!stored) {
          setError(true)
          return
        }
        objectUrl = URL.createObjectURL(stored.blob)
        setAttachment({
          blob: stored.blob,
          name: file?.name ?? fileName ?? stored.name,
          size: file?.size ?? fileSize ?? stored.blob.size,
          url: objectUrl,
        })
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, fileId, fileName, fileSize])

  const name = attachment?.name ?? file?.name ?? fileName ?? 'Attached file'
  const ext = name.split('.').at(-1)?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  const isPptx = ext === 'pptx'
  const isDocx = ext === 'docx'

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex min-w-0 items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          {type === 'PRESENTATION' ? <Presentation className="size-4" /> : <FileText className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900">{name}</span>
          <span className="block text-xs text-zinc-500">
            {attachment ? `${ext.toUpperCase() || 'FILE'} · ${formatBytes(attachment.size)}` : 'Attachment preview'}
          </span>
        </span>
        {attachment && (
          <a href={attachment.url} download={attachment.name} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50">
            <Download className="size-3.5" /> Download
          </a>
        )}
      </div>

      {loading ? (
        <div className="grid h-48 place-items-center text-sm text-zinc-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Loading attachment…</span></div>
      ) : error ? (
        <div className="p-5 text-sm text-zinc-600">This attachment could not be loaded. Try replacing the file and previewing again.</div>
      ) : !attachment ? (
        <div className="p-5 text-sm text-zinc-600">No uploaded file is attached to this material.</div>
      ) : isPdf ? (
        <iframe title={`${title} attachment preview`} src={attachment.url} className="h-[min(65vh,42rem)] min-h-72 w-full bg-zinc-100" />
      ) : isPptx ? (
        <div className="max-h-[65vh] overflow-auto p-3 sm:p-4"><PptxViewer url={attachment.url} title={title} /></div>
      ) : isDocx ? (
        <DocxTextPreview blob={attachment.blob} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-zinc-600">This file type cannot be displayed in the browser. Download the attachment to open it.</p>
          <a href={attachment.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open attachment</a>
        </div>
      )}
    </section>
  )
}

function DocxTextPreview({ blob }: { blob: Blob }) {
  const [paragraphs, setParagraphs] = useState<string[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setParagraphs(null)
    setError(false)

    const readDocument = async () => {
      try {
        const { default: JSZip } = await import('jszip')
        const zip = await JSZip.loadAsync(await blob.arrayBuffer())
        const documentXml = await zip.file('word/document.xml')?.async('string')
        if (!documentXml) throw new Error('Missing Word document body.')
        const xml = new DOMParser().parseFromString(documentXml, 'application/xml')
        if (xml.querySelector('parsererror')) throw new Error('Invalid Word document.')
        const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        const lines = [...xml.getElementsByTagNameNS(wordNamespace, 'p')].map((paragraph) =>
          [...paragraph.getElementsByTagNameNS(wordNamespace, 't')].map((part) => part.textContent ?? '').join(''),
        )
        if (active) setParagraphs(lines)
      } catch {
        if (active) setError(true)
      }
    }

    void readDocument()
    return () => { active = false }
  }, [blob])

  if (error) return <div className="p-5 text-sm text-zinc-600">This Word document could not be previewed. Download the attachment to open it.</div>
  if (!paragraphs) return <div className="grid h-48 place-items-center text-sm text-zinc-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Preparing document preview…</span></div>

  return (
    <div className="max-h-[65vh] overflow-auto bg-zinc-100 p-3 sm:p-5">
      <article className="mx-auto min-h-80 max-w-3xl bg-white px-7 py-8 text-zinc-800 shadow-sm sm:px-12 sm:py-10">
        {paragraphs.map((paragraph, index) => <p key={index} className="min-h-4 whitespace-pre-wrap text-sm leading-7">{paragraph || '\u00a0'}</p>)}
      </article>
    </div>
  )
}
