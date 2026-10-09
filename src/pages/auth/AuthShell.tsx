import { ArrowRight, Award, BookOpen, Play } from 'lucide-react'
import type { ReactNode } from 'react'

const steps = [
  { icon: BookOpen, title: 'Learn', description: <>Explore courses and<br />build your knowledge.</> },
  { icon: Play, title: 'Practice', description: <>Apply what you learn<br />with real scenarios.</> },
  { icon: Award, title: 'Achieve', description: <>Earn certificates and<br />unlock new opportunities.</> },
]

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#cf001f] via-[#bd001d] to-[#e60028] px-10 py-11 text-white lg:flex lg:flex-col xl:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:16px_16px]" />
        <svg aria-hidden="true" viewBox="0 0 500 500" className="absolute -top-20 -right-6 h-[34rem] w-[34rem] text-rose-300/40">
          <path d="M500 -20C460 180 330 310-30 390" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="455" cy="140" r="5" fill="currentColor" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[30%] -bottom-[40%] z-0 size-[55rem] bg-[#ff716d]/40 mix-blend-screen"
          style={{
            maskImage: "url('/M-PESA-money-icon.svg')",
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            WebkitMaskImage: "url('/M-PESA-money-icon.svg')",
            WebkitMaskPosition: 'center',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <svg viewBox="0 0 32 32" className="size-6">
              <path d="M7 21c3-7 6-9 9-9s6 2 9 9" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
              <circle cx={16} cy={9} r={2.5} fill="#fff" />
            </svg>
          </span>
          <span className="text-xl font-semibold tracking-tight">M-PESA Learning</span>
        </div>

        <div className="relative z-10 my-auto mx-auto w-full max-w-lg py-10">
          <h1 className="text-5xl leading-[1.02] font-extrabold tracking-tight xl:text-6xl">
            Learn.<br />
            Grow.<br />
            <span className="text-[#ff716d]">Serve Better.</span>
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-snug text-white/95">
            Build the skills that make every<br className="hidden xl:block" /> customer interaction better.
          </p>

          <ol className="mt-8 space-y-5">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="relative flex items-center gap-5">
                {index < steps.length - 1 && <span aria-hidden="true" className="absolute top-[4.5rem] left-[1.9rem] h-7 w-px bg-white/25" />}
                <span className="grid size-[4.5rem] shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/10">
                  <Icon className="size-8 stroke-[1.8]" />
                </span>
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg font-medium text-white/60">0{index + 1}</span>
                  <span>
                    <span className="block text-lg font-semibold leading-tight">{title}</span>
                    <span className="mt-1 block text-sm leading-snug text-white/85">{description}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative flex items-center gap-3 text-base font-semibold">
          <ArrowRight className="size-6" /> Your growth starts here.
        </p>
      </section>

      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-lg">{children}</div>
      </section>
    </div>
  )
}
