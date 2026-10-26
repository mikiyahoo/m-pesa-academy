import { AlertCircle, AlertTriangle, Check, CheckCircle2, Copy, Download, FileText, FileUp, HelpCircle, Sparkles, Trash2, UploadCloud } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { cn } from "../lib/utils"
import type { FeedbackQuestionType } from "./types"
import { Badge, Button, Modal } from "./ui"
import { extractTextFromDocFile } from "./ImportQuestionsModal"

/* types */
export type ParsedFeedbackQuestion = {
  question: string
  type: FeedbackQuestionType
  category?: string
  warnings?: string[]
}

/* sample template */
const SAMPLE_TEXT = `# Feedback Form Template
# Separate questions with a blank line.
# After each question, add optional Type: and Category: lines.
#
# Type values: likert (default) | yesno | open

The training content was relevant to my daily work.
Type: likert
Category: Content

The trainer explained concepts clearly.
Type: likert
Category: Delivery

I would recommend this training to a colleague.
Type: yesno
Category: Overall

What aspect of the training did you find most valuable?
Type: open
Category: Overall

Any additional feedback or suggestions?
Type: open
Category: Other
`

/* parser */
export function parseFeedbackQuestions(text: string): ParsedFeedbackQuestion[] {
  const lines = text.split(/\r?\n/)
  const questions: ParsedFeedbackQuestion[] = []
  let questionLines: string[] = []
  let currentType: FeedbackQuestionType = "likert"
  let currentCategory = ""
  const warnings: string[] = []

  const flush = () => {
    const q = questionLines.join(" ").trim()
    if (!q) return
    questions.push({ question: q, type: currentType, category: currentCategory || undefined, warnings: warnings.length ? [...warnings] : undefined })
    questionLines = []
    currentType = "likert"
    currentCategory = ""
    warnings.length = 0
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith("#")) continue

    const typeMatch = line.match(/^Type:\s*(.+)/i)
    if (typeMatch) {
      const val = typeMatch[1].trim().toLowerCase()
      if (["likert", "scale", "5-point"].includes(val)) currentType = "likert"
      else if (["yesno", "yes/no", "yes-no", "boolean"].includes(val)) currentType = "yesno"
      else if (["open", "text", "comment", "descriptive"].includes(val)) currentType = "open"
      else { warnings.push(`Unknown type "${typeMatch[1].trim()}", defaulted to likert.`); currentType = "likert" }
      continue
    }
    const catMatch = line.match(/^Category:\s*(.+)/i)
    if (catMatch) { currentCategory = catMatch[1].trim(); continue }
    questionLines.push(line)
  }
  flush()
  return questions
}

/* modal */
export function ImportFeedbackModal({
  open, onClose, onImport, existingCount = 0,
}: {
  open: boolean
  onClose: () => void
  onImport: (questions: ParsedFeedbackQuestion[], mode: "append" | "replace") => void
  existingCount?: number
}) {
  const [activeTab, setActiveTab] = useState<"upload" | "paste" | "guide">("upload")
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<"append" | "replace">("append")
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => {
    if (!text.trim()) return []
    try { return parseFeedbackQuestions(text) } catch { return [] }
  }, [text])

  const likertCount = parsed.filter((q) => q.type === "likert").length
  const yesnoCount = parsed.filter((q) => q.type === "yesno").length
  const openCount = parsed.filter((q) => q.type === "open").length
  const hasWarnings = parsed.some((q) => q.warnings && q.warnings.length > 0)

  const handleFile = async (f: File) => {
    setFileName(f.name); setFileSize(f.size); setIsParsing(true); setParseError(null)
    try { const extracted = await extractTextFromDocFile(f); setText(extracted); setActiveTab("paste") }
    catch (err) { setParseError((err as Error).message || "Failed to read document.") }
    finally { setIsParsing(false) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_TEXT); setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_TEXT], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "feedback_form_template.txt"; a.click()
    URL.revokeObjectURL(url)
  }

  const handleApply = () => { if (!parsed.length) return; onImport(parsed, importMode); onClose() }

  const typeTone = (t: FeedbackQuestionType): "blue" | "green" | "amber" => t === "likert" ? "blue" : t === "yesno" ? "green" : "amber"
  const typeLabel = (t: FeedbackQuestionType) => t === "likert" ? "5-point scale" : t === "yesno" ? "Yes / No" : "Open comment"
  const typeIcon = (t: FeedbackQuestionType) => t === "likert" ? "⭐" : t === "yesno" ? "✓/✗" : "💬"

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={<span className="flex items-center gap-2"><FileUp className="size-5 text-brand-600" /> Import Feedback Questions from Document</span>}
      description="Upload a Word (.docx), Markdown, or plain text file with one question per paragraph."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            {parsed.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-800">Import mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="fbImportMode" value="append" checked={importMode === "append"} onChange={() => setImportMode("append")} className="accent-brand-600" />
                  <span>Append to existing ({existingCount})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="fbImportMode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="accent-brand-600" />
                  <span>Replace existing</span>
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={parsed.length === 0 || isParsing} onClick={handleApply}>
              <Check className="size-4" /> Import {parsed.length ? `${parsed.length} Questions` : "Questions"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-zinc-200">
          {(["upload", "paste", "guide"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={cn("flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
                activeTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-zinc-500 hover:text-zinc-800")}>
              {tab === "upload" && <UploadCloud className="size-4" />}
              {tab === "paste" && <FileText className="size-4" />}
              {tab === "guide" && <HelpCircle className="size-4" />}
              {tab === "upload" ? "Upload Document (.docx, .txt)" : tab === "paste" ? "Paste Text & Editor" : "Format Guide"}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center transition hover:border-brand-500 hover:bg-brand-50/20 cursor-pointer">
              <input ref={fileInputRef} type="file" accept=".docx,.txt,.md,.doc" className="hidden"
                onChange={(e) => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]) }} />
              <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-8 ring-brand-50/50 mb-3">
                <UploadCloud className="size-6" />
              </div>
              <p className="text-sm font-bold text-zinc-900">Click to upload or drag &amp; drop</p>
              <p className="mt-1 text-xs text-zinc-500">Supports Word document (.docx), Markdown (.md), or plain text (.txt)</p>
              <div className="mt-3 flex items-center gap-2">
                {["DOCX", "TXT", "MD"].map((ext) => (
                  <span key={ext} className="rounded-lg bg-zinc-200/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">{ext}</span>
                ))}
              </div>
            </div>

            {fileName && (
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700"><FileText className="size-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{fileName}</p>
                    <p className="text-xs text-zinc-500">{fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : ""} · {isParsing ? "Parsing…" : `${parsed.length} questions parsed`}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFileName(""); setFileSize(null); setText("") }}>
                  <Trash2 className="size-3.5 text-zinc-500" />
                </Button>
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
                <div><p className="font-semibold">Document Reading Error</p><p className="mt-0.5">{parseError}</p></div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-100/70 p-3 text-xs text-zinc-600">
              <span>Need a sample template to get started?</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopySample}>
                  {copied ? <Check className="size-3.5 text-mpesa-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied template" : "Copy sample template"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadSample}>
                  <Download className="size-3.5" /> Download .txt template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Paste tab */}
        {activeTab === "paste" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="fb-import-text" className="text-xs font-semibold text-zinc-700">Paste feedback questions (one per paragraph):</label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setText(SAMPLE_TEXT)}>
                  <Sparkles className="size-3.5 text-amber-600" /> Load sample
                </Button>
                {text && <Button size="sm" variant="ghost" onClick={() => setText("")}>Clear</Button>}
              </div>
            </div>
            <textarea id="fb-import-text" rows={10} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={"The training content was relevant to my work.\nType: likert\nCategory: Content\n\nI would recommend this training.\nType: yesno\n"}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
          </div>
        )}

        {/* Guide tab */}
        {activeTab === "guide" && (
          <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-xs text-zinc-700">
            <h3 className="font-bold text-sm text-zinc-900">Supported Format</h3>
            <p>Write one question per paragraph. After each question add optional <code className="rounded bg-zinc-200 px-1">Type:</code> and <code className="rounded bg-zinc-200 px-1">Category:</code> lines. Separate questions with a blank line.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between"><span className="font-bold text-zinc-900">5-point Likert Scale</span><Badge tone="blue">likert</Badge></div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">{`The content was relevant.\nType: likert\nCategory: Content`}</pre>
                <p className="text-[11px] text-zinc-500">Default type. Omit the Type line to default to likert.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between"><span className="font-bold text-zinc-900">Yes / No Question</span><Badge tone="green">yesno</Badge></div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">{`I'd recommend this training.\nType: yesno\nCategory: Overall`}</pre>
                <p className="text-[11px] text-zinc-500">Simple binary choice. Also accepts yes/no, yes-no, boolean.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between"><span className="font-bold text-zinc-900">Open Comment</span><Badge tone="amber">open</Badge></div>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-[11px] font-mono text-zinc-800">{`What suggestions do you have?\nType: open\nCategory: Other`}</pre>
                <p className="text-[11px] text-zinc-500">Free-text answer. Also accepts text, comment, descriptive.</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-1">
              <p className="font-semibold text-zinc-800">Tips</p>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-600">
                <li>Separate questions with a blank line.</li>
                <li>Lines starting with <code className="bg-zinc-100 rounded px-0.5">#</code> are comments and ignored.</li>
                <li>If <code className="bg-zinc-100 rounded px-0.5">Type:</code> is omitted the question defaults to <strong>likert</strong>.</li>
                <li><code className="bg-zinc-100 rounded px-0.5">Category:</code> is optional — helps organise your question bank.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Live Preview */}
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
                <Badge tone="blue">⭐ {likertCount} Likert</Badge>
                <Badge tone="green">✓/✗ {yesnoCount} Yes/No</Badge>
                <Badge tone="amber">💬 {openCount} Open</Badge>
              </div>
            </div>

            {hasWarnings && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Review parsing notices:</p>
                  {parsed.filter((q) => q.warnings?.length).map((q, idx) => (
                    <p key={idx}>Q{idx + 1}: {q.warnings?.join(" ")}</p>
                  ))}
                </div>
              </div>
            )}

            {parsed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
                No questions could be parsed. Separate questions with blank lines.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {parsed.map((q, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700 mt-0.5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{q.question}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone={typeTone(q.type)}>{typeIcon(q.type)} {typeLabel(q.type)}</Badge>
                          {q.category && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-medium">{q.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
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
