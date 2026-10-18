import { ArrowRight, Award, BookOpen, Play } from 'lucide-react'
import type { ReactNode } from 'react'

const steps = [
  { icon: BookOpen, title: 'Learn', description: <>Explore courses and<br />build your knowledge.</> },
  { icon: Play, title: 'Practice', description: <>Apply what you learn<br />with real scenarios.</> },
  { icon: Award, title: 'Achieve', description: <>Earn certificates and<br />unlock new opportunities.</> },
]

const patternMask = {
  maskImage: "url('/M-PESA%20Pattern.svg')",
  maskPosition: 'center',
  maskRepeat: 'no-repeat',
  maskSize: 'contain',
  WebkitMaskImage: "url('/M-PESA%20Pattern.svg')",
  WebkitMaskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
} as const

function Lockup({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className="relative flex items-center gap-3">
      <img src="/favicon white.svg" alt="" className={(size === 'lg' ? 'size-14 rounded-xl' : 'size-20 rounded-[1.25rem]') + ' shrink-0 shadow-lg shadow-black/10'} />
      <span className="leading-none font-bold tracking-tight text-white">
        <span className={(size === 'lg' ? 'text-xl' : 'text-[1.75rem]') + ' block leading-[1.05]'}>M-PESA</span>
        <span className={(size === 'lg' ? 'text-lg' : 'text-2xl') + ' block leading-[1.05] font-semibold text-white/85'}>Academy</span>
      </span>
    </div>
  )
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col lg:grid lg:grid-cols-2">
      {/* Phones and tablets: a red brand band with the logo, instead of empty space above the form. */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#cf001f] via-[#bd001d] to-[#e60028] flex min-h-64 flex-col justify-between px-6 pt-9 pb-14 sm:min-h-72 sm:px-12 lg:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:16px_16px]" />
        <svg aria-hidden="true" viewBox="0 0 500 500" className="absolute -top-16 -right-24 size-80 text-rose-300/40">
          <path d="M500 -20C460 180 330 310-30 390" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="455" cy="140" r="5" fill="currentColor" />
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -bottom-44 size-[26rem] bg-white/[0.08]" style={patternMask} />
        <Lockup size="sm" />
        <p className="relative mt-8 text-[clamp(1.1rem,5.4vw,1.75rem)] leading-tight font-extrabold tracking-tight whitespace-nowrap text-white">
          Learn. Grow.{' '}
          <span className="text-[#ff9a96]">Serve Better.</span>
        </p>
      </header>
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#cf001f] via-[#bd001d] to-[#e60028] px-10 py-11 text-white lg:flex lg:flex-col xl:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:16px_16px]" />
        <svg aria-hidden="true" viewBox="0 0 500 500" className="absolute -top-20 -right-6 h-[34rem] w-[34rem] text-rose-300/40">
          <path d="M500 -20C460 180 330 310-30 390" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="455" cy="140" r="5" fill="currentColor" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[24rem] -bottom-[38rem] z-0 size-[64rem] bg-white/[0.07]"
          style={patternMask}
        />

        {/* Same lockup as the sidebar logo, a size up. */}
        <Lockup />

        <div className="relative z-10 my-auto mx-auto w-full max-w-lg py-10">
          <h1 className="text-5xl leading-[1.02] font-extrabold tracking-tight xl:text-6xl">
            Learn. Grow.<br />
            <span className="text-[#ff716d]">Serve Better.</span>
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-snug text-white/95">
            Build the skills that make every<br className="hidden xl:block" /> customer interaction better.
          </p>

          <ol className="mt-8 space-y-6">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="relative flex items-center gap-5">
                {index < steps.length - 1 && <span aria-hidden="true" className="absolute top-[calc(50%+1.75rem)] left-7 h-[calc(100%-2rem)] w-px -translate-x-1/2 bg-white/25" />}
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/10">
                  <Icon className="size-6 stroke-[1.8]" />
                </span>
                {/* Fixed-width, tabular number so every title starts at the same x. */}
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 w-7 shrink-0 text-lg font-medium text-white/60 tabular-nums">0{index + 1}</span>
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

      {/* On phones the form card overlaps the red band slightly. */}
      <section className="relative -mt-5 flex flex-1 justify-center rounded-t-3xl bg-white px-6 pt-8 pb-10 sm:px-12 lg:mt-0 lg:items-center lg:rounded-none lg:p-12">
        <div className="w-full max-w-lg">{children}</div>
      </section>
    </div>
  )
}
