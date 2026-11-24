import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { read, utils, writeFile } from 'xlsx'
import { cn } from '../lib/utils'
import { uid, useAdmin } from './store'
import type { AssessmentQuestion, Category, QuestionType } from './types'
import { Button, Modal } from './ui'

const OPTION_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F']
const TYPE_NAMES: Record<string, QuestionType> = {
  'single choice': 'mcq',
  single: 'mcq',
  mcq: 'mcq',
  'multiple choice': 'mcq',
  descriptive: 'descriptive',
  text: 'descriptive',
  'file upload': 'upload',
  upload: 'upload',
}

type Row = { line: number; question?: AssessmentQuestion; problems: string[]; preview: string }

/** Header names are matched ignoring case and spacing, so "Option A" and "option a" both work. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function parseRows(rows: Record<string, unknown>[], categories: Category[], requireCategory: boolean): Row[] {
  return rows
    .map((raw, i): Row | null => {
      const cell = new Map<string, string>()
      for (const [k, v] of Object.entries(raw)) cell.set(norm(k), String(v ?? '').trim())
      const get = (...names: string[]) => names.map((n) => cell.get(norm(n))).find((v) => v) ?? ''
      const text = get('Question', 'Question text')
      const optionTexts = OPTION_COLUMNS.map((l) => get(`Option ${l}`, `Choice ${l}`))
      if (!text && optionTexts.every((o) => !o) && !get('Category', 'Correct answer')) return null // blank row
      const problems: string[] = []
      const line = i + 2 // header is row 1

      const typeName = get('Type').toLowerCase()
      const type: QuestionType = typeName ? (TYPE_NAMES[typeName] ?? 'mcq') : 'mcq'
      if (typeName && !TYPE_NAMES[typeName]) problems.push(`Unknown type “${get('Type')}” (use Single choice, Descriptive or File upload)`)
      if (!text) problems.push('Question text is missing')

      const weightText = get('Weight', 'Points')
      const weight = weightText ? Number(weightText) : 1
      if (!(weight > 0)) problems.push('Weight must be a number above 0')

      const categoryText = get('Category')
      const cat = categoryText ? categories.find((c) => c.name.toLowerCase() === categoryText.toLowerCase()) : undefined
      if (categoryText && !cat) problems.push(`Unknown category “${categoryText}”`)
      if (!categoryText && requireCategory) problems.push('Category is missing')
      const subText = get('Subcategory', 'Sub-category')
      const sub = subText && cat ? cat.subcategories.find((s) => s.name.toLowerCase() === subText.toLowerCase()) : undefined
      if (subText && cat && !sub) problems.push(`“${subText}” is not a sub-category of ${cat.name}`)
      if (subText && !categoryText) problems.push('Choose a category for the sub-category')

      const correct = get('Correct answer', 'Correct', 'Answer')
      let options: string[] | undefined
      let answer: number | string | undefined
      if (type === 'mcq') {
        const kept = optionTexts.map((t, idx) => ({ t, idx })).filter((o) => o.t)
        options = kept.map((o) => o.t)
        if (kept.length < 2) problems.push('Single choice needs at least 2 options')
        const letter = OPTION_COLUMNS.indexOf(correct.toUpperCase())
        const byText = options.findIndex((o) => o.toLowerCase() === correct.toLowerCase())
        const pos = letter >= 0 ? kept.findIndex((o) => o.idx === letter) : byText
        if (!correct) problems.push('Correct answer is missing (a letter A–F or the option text)')
        else if (pos < 0) problems.push(`Correct answer “${correct}” doesn’t match an option`)
        else answer = pos
      } else if (type === 'descriptive') {
        answer = correct || get('Model answer') || undefined
      }
      const question: AssessmentQuestion = {
        id: uid('q'),
        type,
        question: text,
        options,
        answer,
        weight: weight > 0 ? weight : 1,
        category: cat?.name,
        subcategory: sub?.name,
      }
      return { line, question: problems.length ? undefined : question, problems, preview: text || '(no question text)' }
    })
    .filter((r): r is Row => !!r)
}

/** Upload many questions at once from an Excel or CSV sheet (download the template to see the columns). */
export function BulkQuestionsModal({ requireCategory = false, onImport, onClose }: { requireCategory?: boolean; onImport: (questions: AssessmentQuestion[]) => void; onClose: () => void }) {
  const { data } = useAdmin()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const good = (rows ?? []).filter((r) => r.question)
  const bad = (rows ?? []).filter((r) => !r.question)

  const downloadTemplate = () => {
    const header = ['Question', 'Type', 'Weight', 'Category', 'Subcategory', ...OPTION_COLUMNS.map((l) => `Option ${l}`), 'Correct answer']
    const firstCat = data.categories[0]
    const sample = [
      ['Which document is required to register an M-PESA consumer?', 'Single choice', 1, firstCat?.name ?? '', firstCat?.subcategories[0]?.name ?? '', 'National ID or Fayda', 'Utility bill only', 'Bank statement', 'Passport photo only', '', '', 'A'],
      ['Describe how you verify a customer before a PIN reset.', 'Descriptive', 2, firstCat?.name ?? '', '', '', '', '', '', '', '', 'Confirm name, ID and recent transactions; never ask for the PIN.'],
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, utils.aoa_to_sheet([header, ...sample]), 'Questions')
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([['Category', 'Subcategory'], ...data.categories.flatMap((c) => (c.subcategories.length ? c.subcategories.map((s) => [c.name, s.name]) : [[c.name, '']]))]),
      'Categories',
    )
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([
        ['Column', 'How to fill it'],
        ['Question', 'The question text (required).'],
        ['Type', 'Single choice, Descriptive or File upload. Empty means Single choice.'],
        ['Weight', 'A number above 0. Empty means 1.'],
        ['Category / Subcategory', 'Must match the Categories sheet. Optional unless your admin needs it.'],
        ['Option A–F', 'Fill at least 2 for Single choice.'],
        ['Correct answer', 'Single choice: the letter (A–F) or the option text. Descriptive: the model answer.'],
      ]),
      'How to fill',
    )
    writeFile(wb, 'assessment-questions-template.xlsx')
  }

  const readFile = async (file?: File) => {
    if (!file) return
    setReading(true)
    setError('')
    setRows(null)
    try {
      const wb = read(await file.arrayBuffer())
      // The sheet named "Questions" if there is one, otherwise the first.
      const ws = wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase() === 'questions') ?? wb.SheetNames[0]]
      const json = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const parsed = parseRows(json, data.categories, requireCategory)
      if (!parsed.length) throw new Error('No questions found. Use the template: the first row holds the column names.')
      setFileName(file.name)
      setRows(parsed)
    } catch (e) {
      setFileName('')
      setError(e instanceof Error ? e.message : 'The file could not be read.')
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Bulk upload questions"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!good.length}
            onClick={() => {
              onImport(good.map((r) => r.question!))
              onClose()
            }}
          >
            Add {good.length || ''} question{good.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">1. Download the template</p>
            <p className="text-xs text-zinc-500">One question per row: type, weight, category, sub-category, up to 6 options and the correct answer. A sheet lists your categories.</p>
          </div>
          <Button onClick={downloadTemplate}>
            <Download className="size-4" /> Template (.xlsx)
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-zinc-900">2. Upload the filled sheet</p>
          <div
            onDragOver={(e) => (e.preventDefault(), setDragging(true))}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void readFile(e.dataTransfer.files[0])
            }}
            className={cn('flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition', dragging ? 'border-brand-500 bg-brand-50/50' : 'border-zinc-200')}
          >
            <UploadCloud className="size-7 text-zinc-400" />
            <p className="text-sm text-zinc-600">{reading ? 'Reading…' : fileName ? fileName : 'Drag an Excel or CSV file here'}</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void readFile(e.target.files?.[0])} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
              <FileSpreadsheet className="size-3.5" /> {fileName ? 'Choose another file' : 'Choose file'}
            </Button>
          </div>
          {error && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        {rows && (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
              <span className="inline-flex items-center gap-1.5 text-mpesa-700">
                <CheckCircle2 className="size-4" /> {good.length} ready to add
              </span>
              {bad.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-brand-700">
                  <AlertCircle className="size-4" /> {bad.length} with problems (skipped)
                </span>
              )}
            </p>
            {bad.length > 0 && (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs">
                {bad.map((r) => (
                  <li key={r.line}>
                    <span className="font-semibold text-zinc-900">Row {r.line}</span> <span className="text-zinc-500">· {r.preview.slice(0, 70)}</span>
                    <span className="block text-brand-700">{r.problems.join('; ')}</span>
                  </li>
                ))}
              </ul>
            )}
            {good.length > 0 && (
              <ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 text-sm">
                {good.slice(0, 50).map((r) => (
                  <li key={r.question!.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-zinc-800">{r.question!.question}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {r.question!.type === 'mcq' ? 'Single choice' : r.question!.type === 'descriptive' ? 'Descriptive' : 'Upload'} · ×{r.question!.weight}
                      {r.question!.category ? ` · ${r.question!.category}${r.question!.subcategory ? ` › ${r.question!.subcategory}` : ''}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
