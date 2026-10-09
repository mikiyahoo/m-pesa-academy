import { ArrowLeft, Award, Download, Lock, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { currentUser } from '../data/trainings'
import { certificateId, formatDate, progressPercent, progressStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'
import type { Training, TrainingProgress } from '../types'

function CertificateArt({ training, progress, small = false }: { training: Training; progress: TrainingProgress; small?: boolean }) {
  const issued = progress.completedAt ?? training.date
  return (
    <div className={`relative aspect-[1.414] w-full overflow-hidden bg-white ${small ? 'text-[0.45rem]' : 'text-[clamp(0.5rem,1.4vw,1rem)]'}`}>
      <div className="absolute inset-[3%] border-[0.3em] border-mpesa-600" />
      <div className="absolute inset-[4.5%] border border-mpesa-500/50" />
      <div className="absolute -top-[20%] -right-[10%] size-[45%] rounded-full bg-brand-600/10" />
      <div className="absolute -bottom-[25%] -left-[10%] size-[45%] rounded-full bg-mpesa-500/10" />

      <div className="relative flex h-full flex-col items-center justify-center px-[10%] text-center">
        <p className="text-[2.2em] font-extrabold tracking-tight text-brand-600">
          m<span className="text-mpesa-500">-</span>pesa
        </p>
        <p className="mt-[0.6em] text-[1.1em] font-semibold tracking-[0.35em] text-zinc-500 uppercase">Certificate of Completion</p>
        <p className="mt-[1.6em] text-[0.9em] text-zinc-500">This certifies that</p>
        <p className="mt-[0.3em] text-[2.4em] font-semibold text-zinc-900">{currentUser.name}</p>
        <div className="mx-auto mt-[0.3em] h-px w-1/2 bg-zinc-300" />
        <p className="mt-[0.8em] text-[0.9em] text-zinc-500">has successfully completed the training</p>
        <p className="mt-[0.3em] max-w-[90%] text-[1.35em] leading-snug font-semibold text-mpesa-700">{training.title}</p>
        <p className="mt-[0.4em] text-[0.85em] text-zinc-500">with a score of {progress.quizScore}%</p>

        <div className="mt-[2em] grid w-full grid-cols-3 items-end gap-[1em] text-[0.8em]">
          <div>
            <p className="font-medium text-zinc-800">{formatDate(issued)}</p>
            <div className="my-[0.3em] h-px bg-zinc-300" />
            <p className="text-zinc-500">Date issued</p>
          </div>
          <div className="grid place-items-center">
            <span className="grid size-[4.5em] place-items-center rounded-full bg-mpesa-600 text-white ring-[0.3em] ring-mpesa-500/30">
              <Award className="size-[2.4em]" />
            </span>
          </div>
          <div>
            <p className="font-medium text-zinc-800 italic">{training.trainer}</p>
            <div className="my-[0.3em] h-px bg-zinc-300" />
            <p className="text-zinc-500">Trainer</p>
          </div>
        </div>
        <p className="absolute bottom-[7%] text-[0.65em] text-zinc-400">Certificate ID: {certificateId(training)}</p>
      </div>
    </div>
  )
}

export function Certificates() {
  const { trainings, progress } = useStore()
  const earned = trainings.filter((t) => progressStatus(t, progress[t.id]) === 'Completed')
  const inProgress = trainings.filter((t) => progressStatus(t, progress[t.id]) === 'In Progress')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Certificates</h1>
        <p className="text-sm text-zinc-500">
          You’ve earned {earned.length} certificate{earned.length === 1 ? '' : 's'}.
        </p>
      </div>

      {earned.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {earned.map((t) => (
            <Link key={t.id} to={`/certificates/${t.id}`} className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-lg">
              <div className="border-b border-zinc-100 bg-zinc-50 p-4">
                <div className="shadow-sm transition group-hover:scale-[1.02]">
                  <CertificateArt training={t} progress={progress[t.id]} small />
                </div>
              </div>
              <div className="p-4">
                <p className="line-clamp-1 text-sm font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Issued {formatDate(progress[t.id].completedAt ?? t.date)} · Score {progress[t.id].quizScore}%
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center">
          <Award className="size-8 text-zinc-300" />
          <p className="mt-3 text-sm font-medium">No certificates yet</p>
          <p className="text-xs text-zinc-500">Complete a training and pass its assessment to earn one.</p>
        </div>
      )}

      {inProgress.length > 0 && (
        <section>
          <h2 className="font-semibold">Almost there</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inProgress.map((t) => {
              const pct = progressPercent(t, progress[t.id])
              return (
                <Link key={t.id} to={`/trainings/${t.id}`} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-400">
                    <Lock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-zinc-500">{pct}%</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export function CertificateView() {
  const { id = '' } = useParams()
  const { getTraining, progress } = useStore()
  const training = getTraining(id)
  const p = progress[id]

  if (!training || progressStatus(training, p) !== 'Completed') {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">Certificate not available</p>
        <p className="text-sm text-zinc-500">Complete the training and pass the assessment first.</p>
        <Link to="/certificates" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          Back to certificates
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/certificates" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-4" /> All certificates
        </Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
            <Printer className="size-4" /> Print
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Download className="size-4" /> Save as PDF
          </button>
        </div>
      </div>
      <div className="print-area mx-auto max-w-4xl overflow-hidden rounded-xl border border-zinc-200 shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <CertificateArt training={training} progress={p} />
      </div>
    </div>
  )
}
