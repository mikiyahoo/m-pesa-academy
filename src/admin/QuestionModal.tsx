import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'
import { uid, useAdmin } from './store'
import type { AssessmentQuestion, QuestionType } from './types'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Single choice' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'upload', label: 'File upload' },
]

/**
 * Add or edit one question: text, type, weight, category and sub-category (the same Training
 * Categories used on trainings), and the choices with the correct one marked.
 */
export function QuestionModal({
  question,
  title,
  requireCategory = false,
  onSave,
  onClose,
}: {
  question?: AssessmentQuestion
  title?: string
  /** Question-bank questions are filed under a category. */
  requireCategory?: boolean
  onSave: (q: AssessmentQuestion) => void
  onClose: () => void
}) {
  const { data } = useAdmin()
  const [text, setText] = useState(question?.question ?? '')
  const [type, setType] = useState<QuestionType>(question?.type ?? 'mcq')
  const [weight, setWeight] = useState(String(question?.weight ?? 1))
  const [category, setCategory] = useState(question?.category ?? '')
  const [subcategory, setSubcategory] = useState(question?.subcategory ?? '')
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ['', ''])
  const [answer, setAnswer] = useState<number | undefined>(typeof question?.answer === 'number' ? question.answer : undefined)
  const [model, setModel] = useState(typeof question?.answer === 'string' ? question.answer : '')
  const [shuffle, setShuffle] = useState(!!question?.shuffleOptions)
  const [tried, setTried] = useState(false)

  const categoryNames = data.categories.map((c) => c.name)
  // A category that was typed freely before (legacy bank questions) stays selectable.
  const categoryChoices = category && !categoryNames.includes(category) ? [...categoryNames, category] : categoryNames
  const subcategories = data.categories.find((c) => c.name === category)?.subcategories ?? []

  const filled = options.map((o, i) => ({ text: o.trim(), i })).filter((o) => o.text)
  const weightNum = Number(weight)
  const errors = {
    text: !text.trim() ? 'Enter the question text.' : '',
    weight: !(weightNum > 0) ? 'Weight must be more than 0.' : '',
    category: requireCategory && !category ? 'Choose a category.' : '',
    options: type === 'mcq' && filled.length < 2 ? 'At least 2 options are required.' : '',
    answer: type === 'mcq' && filled.length >= 2 && (answer === undefined || !filled.some((o) => o.i === answer)) ? 'Mark the correct option.' : '',
  }
  const ok = !Object.values(errors).some(Boolean)

  const save = () => {
    setTried(true)
    if (!ok) return
    const kept = type === 'mcq' ? filled : []
    onSave({
      id: question?.id ?? uid('q'),
      type,
      question: text.trim(),
      weight: weightNum,
      category: category || undefined,
      subcategory: category && subcategory ? subcategory : undefined,
      options: type === 'mcq' ? kept.map((o) => o.text) : undefined,
      // The correct answer's position among the options that were kept.
      answer: type === 'mcq' ? kept.findIndex((o) => o.i === answer) : type === 'descriptive' ? model.trim() || undefined : undefined,
      shuffleOptions: type === 'mcq' && shuffle ? true : undefined,
    })
    onClose()
  }

  const setOption = (i: number, value: string) => setOptions((os) => os.map((o, k) => (k === i ? value : o)))
  const removeOption = (i: number) => {
    setOptions((os) => os.filter((_, k) => k !== i))
    setAnswer((a) => (a === undefined ? a : a === i ? undefined : a > i ? a - 1 : a))
  }
  const msg = (k: keyof typeof errors) => (tried && errors[k] ? <p className="mt-1 text-xs text-brand-600">{errors[k]}</p> : null)

  return (
    <Modal
      open
      onClose={onClose}
      title={title ?? (question ? 'Edit question' : 'Add question')}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {question ? 'Save question' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Field label="Question text">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. What are the main features of M-PESA for all app?" autoFocus aria-invalid={tried && !!errors.text} />
          </Field>
          {msg('text')}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              {QUESTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <Field label="Weight" hint="Share of the total score">
              <Input type="number" min={1} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} aria-invalid={tried && !!errors.weight} />
            </Field>
            {msg('weight')}
          </div>
          <div>
            <Field label={requireCategory ? 'Category *' : 'Category'}>
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setSubcategory('')
                }}
              >
                <option value="">{requireCategory ? 'Choose a category' : 'None'}</option>
                {categoryChoices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            {msg('category')}
          </div>
          <div>
            <Field label="Subcategory">
              <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!subcategories.length}>
                <option value="">{!category ? 'Choose a category first' : subcategories.length ? 'None' : 'No sub-categories'}</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {type === 'mcq' && (
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Choices</h3>
                <p className="text-xs text-zinc-500">At least 2 options are required.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="size-4 accent-brand-600" /> Shuffle
                </label>
                <Button size="sm" onClick={() => setOptions((os) => [...os, ''])} disabled={options.length >= 8}>
                  <Plus className="size-3.5" /> Add option
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Choice ${i + 1}`} className="flex-1" />
                  <label className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium', answer === i ? 'text-mpesa-700' : 'text-zinc-700')}>
                    <input
                      type="checkbox"
                      checked={answer === i}
                      onChange={() => setAnswer(answer === i ? undefined : i)}
                      className="size-4 accent-mpesa-600"
                      aria-label={`Choice ${i + 1} is the correct answer`}
                    />
                    Correct
                  </label>
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    aria-label={`Remove choice ${i + 1}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-500 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {msg('options')}
            {msg('answer')}
          </div>
        )}

        {type === 'descriptive' && (
          <Field label="Model answer" hint="Shown to the grader">
            <Textarea value={model} onChange={(e) => setModel(e.target.value)} placeholder="What a good answer includes…" />
          </Field>
        )}
        {type === 'upload' && <p className="text-xs text-zinc-500">Learners upload a file; it is graded manually.</p>}
      </div>
    </Modal>
  )
}
