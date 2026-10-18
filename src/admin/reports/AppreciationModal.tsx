import { Mail, Send, X } from 'lucide-react'
import { useState } from 'react'
import { useFeedback } from '../../components/Feedback'
import { localISO } from '../../lib/utils'
import { useAdmin } from '../store'
import { Avatar, Button, Field, Input, Modal, Textarea } from '../ui'

export type Recipient = { id: string; name: string; email: string; reason: string }

const DEFAULT_SUBJECT = 'Thank you for your outstanding learning, {first}!'
const DEFAULT_BODY = `Dear {first},

Congratulations — you're one of our top trainees at M-PESA Academy. {reason}

Thank you for your commitment to learning and for setting a great example for your team. Keep it up!

Warm regards,
{sender}
M-PESA Academy — Learning & Development`

const fill = (text: string, r: Recipient, sender: string) =>
  text.replaceAll('{first}', r.name.split(' ')[0]).replaceAll('{name}', r.name).replaceAll('{reason}', r.reason).replaceAll('{sender}', sender)

/** Compose a personalised appreciation email to one or more top trainees (delivery is simulated). */
export function AppreciationModal({ recipients: initial, onClose }: { recipients: Recipient[]; onClose: () => void }) {
  const { update } = useAdmin()
  const { toast } = useFeedback()
  const sender = 'Training team'
  const [recipients, setRecipients] = useState(initial)
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const sample = recipients[0]

  const send = () => {
    const at = localISO()
    update(
      (d) => ({ ...d, appreciations: [...(d.appreciations ?? []), ...recipients.map((r) => ({ personId: r.id, at, by: sender, subject: fill(subject, r, sender) }))] }),
      { action: 'Sent appreciation email', target: recipients.map((r) => r.name).join(', ') },
    )
    toast(`Appreciation email queued for ${recipients.length} ${recipients.length === 1 ? 'trainee' : 'trainees'}`)
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Send appreciation"
      description="Each person gets their own copy with their name and results filled in."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!recipients.length || !subject.trim() || !body.trim()} onClick={send}>
            <Send className="size-4" /> Send to {recipients.length}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">To</p>
          <div className="flex flex-wrap gap-2">
            {recipients.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 py-1 pr-1.5 pl-1 text-sm">
                <Avatar name={r.name} size="sm" />
                <span className="font-medium text-zinc-800">{r.name}</span>
                <button onClick={() => setRecipients(recipients.filter((x) => x.id !== r.id))} aria-label={`Remove ${r.name}`} className="grid size-5 place-items-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {!recipients.length && <span className="text-sm text-zinc-500">No recipients — close and pick trainees.</span>}
          </div>
        </div>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message" hint="{first}, {name}, {reason} and {sender} are filled in for each person.">
          <Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {sample && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
              <Mail className="size-3.5" /> Preview for {sample.name} · {sample.email}
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">{fill(subject, sample, sender)}</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-700">{fill(body, sample, sender)}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
