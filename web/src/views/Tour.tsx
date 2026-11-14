import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/motion'

/**
 * A short guided walk through the tool for someone seeing it for the first time.
 * Each step sets up a real situation in the app (a site, a date, a view), points at the part of the
 * page that shows it, and says in plain words what to notice. It only starts when asked for.
 */

export interface TourActions {
  openSite: (id: string) => void
  setTime: (t: number) => void
  setPlaying: (on: boolean) => void
  setGlobeView: (v: 'site' | 'system') => void
  setRankView: (v: 'list' | 'map') => void
}

interface Step {
  /** id of the page section this step is about */
  target: string
  title: string
  body: string
  setup: (a: TourActions) => void
}

const START = Date.UTC(2027, 0, 1)

const STEPS: Step[] = [
  {
    target: 'sec-moon',
    title: 'A lander needs two things from the sky',
    body: 'Sunlight for power, and a clear line to Earth for radio. This is a ridge beside Shackleton crater, almost exactly at the Moon\'s south pole. The sentence on the right says whether the lander has both right now, and for how long.',
    setup: (a) => {
      a.setPlaying(false)
      a.setGlobeView('site')
      a.openSite('shackleton-ridge')
      a.setTime(START)
    },
  },
  {
    target: 'sec-sky',
    title: 'At the pole, everything happens at the horizon',
    body: 'This is the sky from the ridge, unrolled. The grey shape is the surrounding terrain. The Sun follows the dotted line and never climbs more than about 1.5 degrees; Earth follows the blue loop and sinks behind the hills for days at a time. Time is now running: watch them move.',
    setup: (a) => {
      a.openSite('shackleton-ridge')
      a.setTime(START)
      a.setPlaying(true)
    },
  },
  {
    target: 'sec-moon',
    title: 'A short move changes everything',
    body: 'Same date, but now the floor of Malapert crater, a few degrees away. Its walls rise up to 22 degrees all around, so the Sun and Earth never clear them: no power and no contact, all year. Terrain decides the answer.',
    setup: (a) => {
      a.setPlaying(false)
      a.openSite('malapert')
      a.setTime(START)
    },
  },
  {
    target: 'sec-rank',
    title: 'So where is it good to land?',
    body: 'This map scores every 4 km of the south polar region for the chosen date, using the real terrain around each cell. Bright is good; dark grey is too steep. The numbered spots are the best areas. Click any cell to open it.',
    setup: (a) => {
      a.setPlaying(false)
      a.setRankView('map')
      a.setTime(START + 17 * 86400000)
    },
  },
  {
    target: 'sec-year',
    title: 'And when?',
    body: 'Missions slip. For a fixed site, this chart scores every possible landing date over the next 12 months and marks the best ones. Below it, the slider shows what you gain or lose if the landing moves by days or weeks.',
    setup: (a) => {
      a.setPlaying(false)
      a.openSite('im-2')
    },
  },
  {
    target: 'sec-compare',
    title: 'Compare, then share',
    body: 'Use "Pin this scenario" in the top bar to keep a site and date here, then pin another: you get the numbers and the two skies side by side. "Copy link" gives you an address that reopens exactly this view. That is the tour; the tool is yours.',
    setup: (a) => a.setPlaying(false),
  },
]

export default function Tour({ actions, onClose }: { actions: TourActions; onClose: () => void }) {
  const [i, setI] = useState(0)
  const reduced = useReducedMotion()
  const next = useRef<HTMLButtonElement>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  useEffect(() => {
    step.setup(actions)
    // Let the page react to the setup before scrolling to the section it changed.
    const id = window.setTimeout(() => {
      const el = document.getElementById(step.target)
      el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      el?.classList.add('tour-focus')
    }, 80)
    next.current?.focus({ preventScroll: true })
    return () => {
      window.clearTimeout(id)
      document.getElementById(step.target)?.classList.remove('tour-focus')
    }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    actions.setPlaying(false)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
      role="dialog"
      aria-label="Guided tour"
      className="enter fixed inset-x-3 bottom-3 z-40 rounded-xl border border-line bg-raised p-4 shadow-2xl shadow-black sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="num text-xs text-muted">
          Step {i + 1} of {STEPS.length}
        </span>
        <button className="text-xs text-muted underline hover:text-ink" onClick={close}>
          Close the tour
        </button>
      </div>
      <h2 className="display mt-2 text-base leading-snug">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/90">{step.body}</p>
      <div className="mt-4 flex justify-between gap-2">
        <button className="btn" onClick={() => setI((v) => v - 1)} disabled={i === 0}>
          Back
        </button>
        <button ref={next} className="btn btn-primary min-w-28" onClick={() => (last ? close() : setI((v) => v + 1))}>
          {last ? 'Finish' : 'Next'}
        </button>
      </div>
    </aside>
  )
}
