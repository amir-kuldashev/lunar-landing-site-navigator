import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/motion'

/**
 * A guided walk through the tool for someone seeing it for the first time.
 *
 * Each step sets up a real situation in the app (a site, a date, a view), dims the rest of the page,
 * lights up the one part that shows it, and points an arrow from the explanation to that part.
 * The page stays usable underneath, so "click a cell" in a step really can be tried.
 * It only starts when asked for.
 */

export interface TourActions {
  openSite: (id: string) => void
  setTime: (t: number) => void
  setPlaying: (on: boolean) => void
  setGlobeView: (v: 'site' | 'system') => void
  setRankView: (v: 'list' | 'map') => void
}

interface Step {
  /** CSS selectors for the part of the page this step is about; the first one found is used. */
  target: string[]
  title: string
  body: string
  setup: (a: TourActions) => void
}

const START = Date.UTC(2027, 0, 1)
const DAY = 86400000
const at = (name: string) => `[data-tour="${name}"]`

const STEPS: Step[] = [
  {
    target: [at('verdict')],
    title: 'A lander needs two things from the sky',
    body: 'Sunlight for power, and a clear line to Earth for radio. This is a ridge beside Shackleton crater, almost exactly at the Moon\'s south pole. This sentence says whether a lander here has both right now, and for how long.',
    setup: (a) => {
      a.setPlaying(false)
      a.setGlobeView('site')
      a.openSite('shackleton-ridge')
      a.setTime(START)
    },
  },
  {
    target: [at('moon')],
    title: 'The Moon as it is lit right now',
    body: 'The bright side faces the real Sun for the chosen moment. The white ring is the lander\'s horizon; the yellow pointer aims at the Sun and the blue one at Earth. Drag to turn the Moon, or switch to "Sun, Moon and Earth" to step back.',
    setup: (a) => {
      a.setPlaying(false)
      a.setGlobeView('site')
      a.openSite('shackleton-ridge')
      a.setTime(START)
    },
  },
  {
    target: [at('sky')],
    title: 'At the pole, everything happens at the horizon',
    body: 'This is the sky from the ridge, unrolled into a strip. The grey shape is the surrounding terrain. The Sun follows the dotted line and never climbs more than about 1.5 degrees. Earth follows the blue loop and sinks behind the hills for days. Time is running now: watch them move.',
    setup: (a) => {
      a.openSite('shackleton-ridge')
      a.setTime(START)
      a.setPlaying(true)
    },
  },
  {
    target: [at('readouts')],
    title: 'A short move changes everything',
    body: 'Same date, but now the floor of Malapert crater, a few degrees away. Its walls rise up to 22 degrees all around, so neither the Sun nor Earth ever clears them. No power and no contact, all year. Terrain decides the answer.',
    setup: (a) => {
      a.setPlaying(false)
      a.openSite('malapert')
      a.setTime(START)
    },
  },
  {
    target: [at('polar-map'), '#sec-rank'],
    title: 'So where is it good to land?',
    body: 'This map scores every 4 km of the south polar region for the chosen date, using the real terrain around each cell. Bright is good; dark grey is too steep. The numbered spots are the best areas. Try it: click any cell to open that point.',
    setup: (a) => {
      a.setPlaying(false)
      a.setRankView('map')
      a.setTime(START + 17 * DAY)
    },
  },
  {
    target: [at('dates'), '#sec-year'],
    title: 'And when?',
    body: 'Missions slip. For a fixed site, this chart scores every possible landing date over the next 12 months and numbers the best ones. Drag across it to zoom into a few weeks, or press Go on a date to jump there.',
    setup: (a) => {
      a.setPlaying(false)
      a.openSite('im-2')
    },
  },
  {
    target: [at('slip'), '#sec-slip'],
    title: 'What a delay costs',
    body: 'Slide the landing earlier or later. The four cards show what gets better or worse: sunlight, Earth contact, both together, and the longest night the lander must survive.',
    setup: (a) => a.setPlaying(false),
  },
  {
    target: [at('pin')],
    title: 'Compare, then share',
    body: 'Pin a site and date here, then pin another: lower down you get the numbers and the two skies side by side. "Copy link" beside it gives an address that reopens exactly this view. That is the tour. The tool is yours.',
    setup: (a) => a.setPlaying(false),
  },
]

const CARD_W = 380
const GAP = 22
const PAD = 8

type Side = 'right' | 'left' | 'below' | 'above' | 'corner'
interface Layout {
  target: DOMRect | null
  card: { left: number; top: number }
  side: Side
}

function findTarget(step: Step): HTMLElement | null {
  for (const sel of step.target) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el && el.getClientRects().length > 0) return el
  }
  return null
}

/** Where to put the card so it sits beside the lit area without covering it. */
function place(rect: DOMRect | null, cardH: number): Layout {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(CARD_W, vw - 24)
  const clampX = (x: number) => Math.max(12, Math.min(x, vw - w - 12))
  const clampY = (y: number) => Math.max(12, Math.min(y, vh - cardH - 12))
  const corner: Layout = { target: rect, card: { left: vw - w - 16, top: vh - cardH - 16 }, side: 'corner' }
  if (!rect) return corner
  const midY = rect.top + rect.height / 2 - cardH / 2
  const midX = rect.left + rect.width / 2 - w / 2
  if (vw - rect.right >= w + GAP + 12) return { target: rect, card: { left: rect.right + GAP, top: clampY(midY) }, side: 'right' }
  if (rect.left >= w + GAP + 12) return { target: rect, card: { left: rect.left - GAP - w, top: clampY(midY) }, side: 'left' }
  if (vh - rect.bottom >= cardH + GAP + 12) return { target: rect, card: { left: clampX(midX), top: rect.bottom + GAP }, side: 'below' }
  if (rect.top >= cardH + GAP + 12) return { target: rect, card: { left: clampX(midX), top: rect.top - GAP - cardH }, side: 'above' }
  return corner
}

/** A curved arrow from the card's edge to the lit area's edge, in viewport pixels. */
function arrowPath(l: Layout, cardH: number, cardW: number): { d: string; tip: [number, number]; angle: number } | null {
  const r = l.target
  if (!r) return null
  const c = { left: l.card.left, top: l.card.top, right: l.card.left + cardW, bottom: l.card.top + cardH }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
  let from: [number, number]
  let to: [number, number]
  if (l.side === 'right') {
    from = [c.left, clamp(r.top + r.height / 2, c.top + 24, c.bottom - 24)]
    to = [r.right + PAD + 2, clamp(from[1], r.top + 10, r.bottom - 10)]
  } else if (l.side === 'left') {
    from = [c.right, clamp(r.top + r.height / 2, c.top + 24, c.bottom - 24)]
    to = [r.left - PAD - 2, clamp(from[1], r.top + 10, r.bottom - 10)]
  } else if (l.side === 'below') {
    from = [clamp(r.left + r.width / 2, c.left + 24, c.right - 24), c.top]
    to = [clamp(from[0], r.left + 10, r.right - 10), r.bottom + PAD + 2]
  } else if (l.side === 'above') {
    from = [clamp(r.left + r.width / 2, c.left + 24, c.right - 24), c.bottom]
    to = [clamp(from[0], r.left + 10, r.right - 10), r.top - PAD - 2]
  } else {
    // Card is tucked in the corner: point from its top-left toward the nearest part of the lit area.
    from = [c.left + 28, c.top]
    to = [clamp(from[0] - 60, r.left + 12, r.right - 12), clamp(c.top - 60, r.top + 12, r.bottom - 12)]
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 36) return null
  }
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  if (len < 10) return null
  // A gentle bow, so the arrow reads as drawn rather than ruled.
  const bow = Math.min(18, len * 0.22)
  const mx = (from[0] + to[0]) / 2 - (dy / len) * bow
  const my = (from[1] + to[1]) / 2 + (dx / len) * bow
  const angle = (Math.atan2(to[1] - my, to[0] - mx) * 180) / Math.PI
  return { d: `M${from[0]} ${from[1]} Q${mx} ${my} ${to[0]} ${to[1]}`, tip: to, angle }
}

export const TOUR_STEPS = STEPS.length

export default function Tour({
  actions,
  onClose,
  startAt = 0,
}: {
  actions: TourActions
  onClose: () => void
  /** Step to open on, counting from 0. */
  startAt?: number
}) {
  const [i, setI] = useState(() => Math.min(Math.max(startAt, 0), STEPS.length - 1))
  const [layout, setLayout] = useState<Layout | null>(null)
  const [cardH, setCardH] = useState(240)
  /** False while a step is being set up and scrolled to, so nothing is drawn half-way there. */
  const [shown, setShown] = useState(false)
  const reduced = useReducedMotion()
  const card = useRef<HTMLElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const cardW = Math.min(CARD_W, (typeof window !== 'undefined' ? window.innerWidth : CARD_W) - 24)

  // While the tour is open the visitor cannot scroll the page: the tour moves it. Scrolling by hand
  // pulled the lit area out from under the card. The page itself still responds to clicks.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const before = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight }
    // Hiding the scrollbar would widen the page and shift everything; keep its width as padding.
    const bar = window.innerWidth - html.clientWidth
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (bar > 0) body.style.paddingRight = `${bar}px`
    return () => {
      html.style.overflow = before.html
      body.style.overflow = before.body
      body.style.paddingRight = before.pad
    }
  }, [])

  // Each step, in order: set the scene, wait for the page to settle, jump to the area (no smooth
  // scroll to chase), measure, and only then fade the spotlight, arrow and card in together.
  useEffect(() => {
    setShown(false)
    step.setup(actions)
    let raf = 0
    let alive = true
    let lastKey = ''
    const measure = () => {
      if (!alive) return
      const rect = findTarget(step)?.getBoundingClientRect() ?? null
      const h = card.current?.offsetHeight ?? 240
      // Only re-render when something actually moved.
      const key = rect
        ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)},${h},${window.innerWidth},${window.innerHeight}`
        : `none,${h},${window.innerWidth},${window.innerHeight}`
      if (key === lastKey) return
      lastKey = key
      setCardH(h)
      setLayout(place(rect, h))
    }
    // The page can keep shifting for a moment after the jump (data arriving, sections resizing).
    const follow = () => {
      measure()
      raf = requestAnimationFrame(follow)
    }
    const settle = window.setTimeout(() => {
      if (!alive) return
      findTarget(step)?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' })
      measure()
      raf = requestAnimationFrame(() => {
        if (!alive) return
        setShown(true)
        next.current?.focus({ preventScroll: true })
        follow()
      })
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(settle)
      cancelAnimationFrame(raf)
    }
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight)
  }, [i])

  const close = () => {
    actions.setPlaying(false)
    onClose()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = shown && layout !== null
  const fade = visible ? 1 : 0
  const fadeTransition = reduced ? 'none' : 'opacity 220ms var(--ease-smooth)'
  const r = layout?.target ?? null
  const arrow = layout ? arrowPath(layout, cardH, cardW) : null
  const spot = r
    ? { left: r.left - PAD, top: r.top - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD }
    : null

  return (
    <>
      {/* Dim everything except the lit area. Clicks pass through, so the page stays usable. */}
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-xl"
          style={{
            ...spot,
            boxShadow: `0 0 0 2px rgba(88, 166, 232, ${fade}), 0 0 0 200vmax rgba(0, 0, 0, 0.68)`,
            transition: reduced ? 'none' : 'box-shadow 220ms var(--ease-smooth)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/60" />
      )}

      {arrow && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" style={{ opacity: fade, transition: fadeTransition }}>
          <path d={arrow.d} fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
          <path d={arrow.d} fill="none" stroke="var(--color-earth)" strokeWidth="2.5" strokeLinecap="round" />
          <g transform={`translate(${arrow.tip[0]} ${arrow.tip[1]}) rotate(${arrow.angle})`}>
            <path d="M-15 -8 L0 0 L-15 8" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
            <path d="M-15 -8 L0 0 L-15 8" fill="none" stroke="var(--color-earth)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      )}

      <aside
        ref={card}
        role="dialog"
        aria-label="Guided tour"
        className="fixed z-50 rounded-xl border border-earth/60 bg-raised p-5 shadow-2xl shadow-black"
        style={{
          width: cardW,
          left: layout?.card.left ?? 16,
          top: layout?.card.top ?? 16,
          opacity: fade,
          pointerEvents: visible ? 'auto' : 'none',
          transition: fadeTransition,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`} role="img">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full ${k === i ? 'w-5 bg-earth' : k < i ? 'w-1.5 bg-earth/60' : 'w-1.5 bg-line'}`}
              />
            ))}
          </div>
          <button className="text-xs text-muted underline hover:text-ink" onClick={close}>
            Close the tour
          </button>
        </div>
        <h2 className="display mt-3 text-base leading-snug">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/90">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button className="btn" onClick={() => setI((v) => v - 1)} disabled={i === 0}>
            Back
          </button>
          <span className="num text-xs text-muted">
            {i + 1} of {STEPS.length}
          </span>
          <button ref={next} className="btn btn-primary min-w-28" onClick={() => (last ? close() : setI((v) => v + 1))}>
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </aside>
    </>
  )
}
