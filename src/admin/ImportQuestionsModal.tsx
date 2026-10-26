import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, Download, FileText, FileUp, HelpCircle, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { uid } from './store'
import type { AssessmentQuestion } from './types'
import { Badge, Button, Modal } from './ui'

export type ParsedDocQuestion = AssessmentQuestion & {
  rawIndex: number
  warnings?: string[]
}

const SAMPLE_TEXT = `1. Which document is required to register an M-PESA consumer?
A. National ID or Fayda
B. Utility bill only
C. Bank statement
D. Passport photo only
ANSWER: A
Points: 1

2. What does B2C stand for?
A) Bank to Customer
*B) Business to Customer
C) Buy to Collect
Weight: 2

3. What should a customer never share with anyone, including agents?
A. Their name
B. Their phone number
C. Their PIN
D. Their Fayda ID
Answer: C

4. A customer reports a failed transfer where their balance was debited. Describe the verification and resolution procedure.
Type: Descriptive
Answer: Verify the customer identity and transaction reference, inform them of the standard 24-hour reversal settlement window, log an escalation ticket if unsettled, and never request their PIN or OTP.
Points: 3`

export async function extractTextFromDocFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    try {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(file)
      const xml = await zip.file('word/document.xml')?.async('text')
      if (!xml) throw new Error('Could not find word/document.xml in .docx file.')
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'application/xml')
      const paragraphs = Array.from(doc.getElementsByTagName('w:p'))
      const lines = paragraphs.map((p) => {
        const texts = Array.from(p.getElementsByTagName('w:t'))
        return texts.map((t) => t.textContent || '').join('')
      })
      return lines.join('\n')
    } catch (err) {
      throw new Error(`Failed to read Word (.docx) file: ${(err as Error).message}`)
    }
  }
  return await file.text()
}

export function parseDocumentQuestions(text: string): ParsedDocQuestion[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const blocks: string[][] = []
  let cur: string[] = []

  const isQStart = (l: string) => /^\s*(?:(?:\d+|[ivx]+)[\.\)]|Q\d+[:\.\)]|Question\s+\d+[:\.\)])\s+/i.test(l)
  const isAnswer = (l: string) => /^\s*(?:ANSWER|Answer|ANS|Ans|Correct|Correct Answer)[:\s]/i.test(l)

  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i]
    if (!l.trim()) {
      if (cur.some((x) => x.trim())) {
        blocks.push(cur)
        cur = []
      }
      continue
    }
    if (isQStart(l) && cur.some((x) => x.trim())) {
      blocks.push(cur)
      cur = [l]
      continue
    }
    cur.push(l)
  }
  if (cur.some((x) => x.trim())) blocks.push(cur)

  const parsed: ParsedDocQuestion[] = []
  let counter = 1

  for (const block of blocks) {
    if (!block.length) continue
    const qLines: string[] = []
    const options: string[] = []
    let answerIdx: number | undefined = undefined
    let modelAnswer = ''
    let isDescriptive = false
    let weight = 1
    const warnings: string[] = []
    let state: 'question' | 'options' = 'question'

    for (const line of block) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (/^\s*(?:Type|Kind):\s*(?:Descriptive|Open|Text|Essay)/i.test(trimmed)) {
        isDescriptive = true
        continue
      }

      const weightMatch = trimmed.match(/^\s*(?:Weight|Points|Marks?):\s*(\d+)/i)
      if (weightMatch) {
        weight = Math.max(1, parseInt(weightMatch[1], 10))
        continue
      }

      if (isAnswer(trimmed)) {
        const val = trimmed.replace(/^\s*(?:ANSWER|Answer|ANS|Ans|Correct|Correct Answer)[:\s]+/i, '').trim()
        if (isDescriptive || (!options.length && val.length > 2 && !/^[A-H]$/i.test(val))) {
          isDescriptive = true
          modelAnswer = val
        } else {
          const letterMatch = val.match(/^([A-Ha-h]|\d+)/)
          if (letterMatch) {
            const token = letterMatch[1].toUpperCase()
            if (/[A-H]/.test(token)) {
              answerIdx = token.charCodeAt(0) - 65
            } else {
              answerIdx = parseInt(token, 10) - 1
            }
          }
        }
        continue
      }

      const optMatch = trimmed.match(/^\s*(\*?)\s*(?:([A-Ha-h])[\.\)]|\(([A-Ha-h])\)|\*)\s+(.*)$/)
      if (optMatch && !isDescriptive) {
        state = 'options'
        const isStar = optMatch[1] === '*' || optMatch[0].trim().startsWith('*') || /\*\s*$/.test(optMatch[4]) || /\(Correct\)/i.test(optMatch[4])
        const cleanOpt = optMatch[4].replace(/\s*\*+\s*$/, '').replace(/\s*\(Correct\)\s*/i, '').trim()
        const thisIdx = options.length
        options.push(cleanOpt)
        if (isStar) {
          answerIdx = thisIdx
        }
        continue
      }

      if (state === 'question') {
        qLines.push(trimmed)
      } else if (state === 'options' && options.length > 0) {
        options[options.length - 1] += ' ' + trimmed
      }
    }

    const questionText = qLines.join(' ').replace(/^\s*(?:(?:\d+|[ivx]+)[\.\)]|Q\d+[:\.\)]|Question\s+\d+[:\.\)])\s+/i, '').trim()
    if (!questionText) continue

    if (isDescriptive) {
      parsed.push({
        id: uid('q'),
        rawIndex: counter++,
        type: 'descriptive',
        question: questionText,
        answer: modelAnswer || '',
        weight,
        warnings: modelAnswer ? [] : ['No model answer provided.'],
      })
    } else {
      if (options.length < 2) {
        warnings.push('Fewer than 2 options detected.')
      }
      if (answerIdx === undefined || answerIdx < 0 || answerIdx >= options.length) {
        answerIdx = 0
        warnings.push('No correct answer marked; defaulted to Option A.')
      }
      parsed.push({
        id: uid('q'),
        rawIndex: counter++,
        type: 'mcq',
        question: questionText,
        options,
        answer: answerIdx,
        weight,
        warnings,
      })
    }
  }

  return parsed
}

export function ImportQuestionsModal({
  open,
  onClose,
  onImport,
  existingCount = 0,
}: {
  open: boolean
  onClose: () => void
  onImport: (questions: AssessmentQuestion[], mode: 'append' | 'replace') => void
  existingCount?: number
}) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'guide'>('upload')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return []
    try {
      return parseDocumentQuestions(text)
    } catch {
      return []
    }
  }, [text])

  const mcqCount = parsed.filter((q) => q.type === 'mcq').length
  const descCount = parsed.filter((q) => q.type === 'descriptive').length
  const totalWeight = parsed.reduce((sum, q) => sum + (q.weight || 1), 0)
  const hasWarnings = parsed.some((q) => q.warnings && q.warnings.length > 0)

  const handleFile = async (f: File) => {
    setFileName(f.name)
    setFileSize(f.size)
    setIsParsing(true)
    setParseError(null)
    try {
      const extracted = await extractTextFromDocFile(f)
      setText(extracted)
    } catch (err) {
      setParseError((err as Error).message || 'Failed to read document.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_TEXT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_TEXT], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'assessment_questions_template.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleApply = () => {
    if (!parsed.length) return
    const cleanQuestions: AssessmentQuestion[] = parsed.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      answer: q.answer,
      weight: q.weight,
    }))
    onImport(cleanQuestions, importMode)
    onClose()
  }

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <FileUp className="size-5 text-brand-600" /> Import Questions from Document
        </span>
      }
      description="Upload a Word (.docx) or text document, or paste questions formatted in standard Aiken / Q&A format."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            {parsed.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-800">Import mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="accent-brand-600"
                  />
                  <span>Append to existing ({existingCount})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-brand-600"
                  />
                  <span>Replace existing</span>
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={parsed.length === 0 || isParsing} onClick={handleApply}>
              <Check className="size-4" /> Import {parsed.length ? `${parsed.length} Questions` : 'Questions'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              activeTab === 'upload' ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-500 hover:text-zinc-800',
            )}
          >
            <UploadCloud className="size-4" /> Upload Document (.docx, .txt)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              activeTab === 'paste' ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-500 hover:text-zinc-800',
            )}
          >
            <FileText className="size-4" /> Paste Text & Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              activeTab === 'guide' ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-500 hover:text-zinc-800',
            )}
          >
            <HelpCircle className="size-4" /> Supported Formats Guide
          </button>
        </div>

        {/* Tab 1: Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center transition hover:border-brand-500 hover:bg-brand-50/20 cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.md,.doc"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0])
                }}
              />
              <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-8 ring-brand-50/50 mb-3">
                <UploadCloud className="size-6" />
              </div>
              <p className="text-sm font-bold text-zinc-900">Click to upload or drag & drop</p>
              <p className="mt-1 text-xs text-zinc-500">Supports Word document (.docx), Markdown (.md), or plain text (.txt)</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-lg bg-zinc-200/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">DOCX</span>
                <span className="rounded-lg bg-zinc-200/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">TXT</span>
                <span className="rounded-lg bg-zinc-200/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">MD</span>
              </div>
            </div>

            {fileName && (
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{fileName}</p>
                    <p className="text-xs text-zinc-500">
                      {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : ''} · {isParsing ? 'Parsing document…' : `${parsed.length} questions parsed`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFileName('')
                      setFileSize(null)
                      setText('')
                    }}
                  >
                    <Trash2 className="size-3.5 text-zinc-500" />
                  </Button>
                </div>
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-brand-600" />
                <div>
                  <p className="font-semibold">Document Reading Error</p>
                  <p className="mt-0.5">{parseError}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-100/70 p-3 text-xs text-zinc-600">
              <span>Need a sample template to get started?</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopySample}>
                  {copied ? <Check className="size-3.5 text-mpesa-600" /> : <Copy className="size-3.5" />}
                  {copied ? 'Copied template' : 'Copy sample template'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadSample}>
                  <Download className="size-3.5" /> Download .txt template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Paste Text */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="raw-import-text" className="text-xs font-semibold text-zinc-700">
                Paste your question document text below:
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setText(SAMPLE_TEXT)}>
                  <Sparkles className="size-3.5 text-amber-600" /> Load sample questions
                </Button>
                {text && (
                  <Button size="sm" variant="ghost" onClick={() => setText('')}>
                    Clear text
                  </Button>
                )}
              </div>
            </div>
            <textarea
              id="raw-import-text"
              ref={textareaRef}
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`1. What is the standard M-PESA USSD code?\nA. *334#\nB. *123#\nC. *888#\nANSWER: A\nPoints: 1\n\n2. Next question...\n`}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        )}

        {/* Tab 3: Format Guide */}
        {activeTab === 'guide' && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-xs text-zinc-700">
            <h3 className="font-bold text-sm text-zinc-900">Supported Document Formats</h3>
            <p>You can write or paste questions in standard formats used in Microsoft Word, Google Docs, or text files:</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">Multiple Choice (Standard Aiken)</span>
                  <Badge tone="blue">Aiken Format</Badge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">
{`1. What is the national digital ID of Ethiopia?
A. Fayda
B. Kebele
C. Passport
ANSWER: A`}
                </pre>
                <p className="text-[11px] text-zinc-500">Option letters can use A. or A) or (A). ANSWER: A marks the correct option.</p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">Asterisk / Star Answer Marker</span>
                  <Badge tone="green">Asterisk</Badge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">
{`2. B2C stands for:
A. Bank to Customer
*B. Business to Customer
C. Buy to Collect
Weight: 2`}
                </pre>
                <p className="text-[11px] text-zinc-500">Put an asterisk (*) in front of or behind the correct option. Add Weight: 2 for custom points.</p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">Descriptive / Open-Ended Question</span>
                  <Badge tone="amber">Descriptive</Badge>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">
{`3. Explain the PIN reset verification process for an agent.
Type: Descriptive
Answer: Verify caller identity via Fayda, check recent transaction history, never ask for current PIN or OTP.
Points: 3`}
                </pre>
                <p className="text-[11px] text-zinc-500">Mark with Type: Descriptive. The Answer: line is saved as the model answer for the grader.</p>
              </div>
            </div>
          </div>
        )}

        {/* Live Parsed Questions Preview Section */}
        {text.trim() && (
          <div className="border-t border-zinc-200 pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900">Parsed Preview ({parsed.length} questions)</h3>
                {parsed.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-mpesa-700 bg-mpesa-50 px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="size-3.5" /> Ready to import
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge tone="blue">{mcqCount} Multiple Choice</Badge>
                <Badge tone="amber">{descCount} Descriptive</Badge>
                <Badge tone="zinc">{totalWeight} Total Points</Badge>
              </div>
            </div>

            {hasWarnings && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Review parsing notices:</p>
                  {parsed.filter((q) => q.warnings?.length).map((q, idx) => (
                    <p key={idx}>
                      Question {q.rawIndex}: {q.warnings?.join(' ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {parsed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
                No questions could be parsed from the provided text. Make sure questions have options (A. B. C.) and an ANSWER: line.
              </div>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto scrollbar-thin pr-1">
                {parsed.map((q, idx) => (
                  <div key={q.id || idx} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{q.question}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge tone={q.type === 'mcq' ? 'blue' : 'amber'}>
                              {q.type === 'mcq' ? 'Multiple choice' : 'Descriptive'}
                            </Badge>
                            <span className="text-xs text-zinc-500">Points: ×{q.weight}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {q.type === 'mcq' && q.options && (
                      <div className="mt-2.5 pl-8 space-y-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.answer === optIdx
                          return (
                            <div
                              key={optIdx}
                              className={cn(
                                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition',
                                isCorrect ? 'bg-mpesa-500/10 font-semibold text-mpesa-800 ring-1 ring-mpesa-500/30' : 'text-zinc-600 bg-zinc-50/50',
                              )}
                            >
                              <span
                                className={cn(
                                  'grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                                  isCorrect ? 'bg-mpesa-600 text-white' : 'bg-zinc-200 text-zinc-600',
                                )}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-mpesa-700">
                                  <Check className="size-3" /> Correct Answer
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {q.type === 'descriptive' && (
                      <div className="mt-2.5 pl-8">
                        <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-900 border border-amber-200/50">
                          <span className="font-semibold block mb-0.5 text-amber-800">Model Answer:</span>
                          {q.answer ? String(q.answer) : <span className="italic text-zinc-400">None specified</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
