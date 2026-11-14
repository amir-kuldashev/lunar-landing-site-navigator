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
  /** Pixels to trim from the target's edges, so the light falls on exactly the thing being described. */
  inset?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Light a circle instead of a rectangle, for a round subject. */
  round?: boolean
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
    // Leave the panel's title row and view buttons out: this step is about the Moon itself.
    inset: { top: 114 },
    title: 'The Moon as it is lit right now',
    body: 'The bright side faces the real Sun for the chosen moment. The white ring is the lander\'s horizon; the yellow pointer aims at the Sun and the blue one at Earth. You can drag the Moon to turn it.',
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
    target: [at('sun-earth')],
    title: 'A short move changes everything',
    body: 'Same date, but now the floor of Malapert crater, a few degrees away. Its walls rise up to 22 degrees all around, so neither the Sun nor Earth ever clears them. No power and no contact, all year. Terrain decides the answer.',
    setup: (a) => {
      a.setPlaying(false)
      a.openSite('malapert')
      a.setTime(START)
    },
  },
  {
    target: [at('polar-map')],
    // The map is a disc: light the disc, not the square it sits in.
    round: true,
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

const CARD_W = 410
const GAP = 22
const PAD = 8

type Side = 'right' | 'left' | 'below' | 'above' | 'corner'
interface Layout {
  target: DOMRect | null
  card: { left: number; top: number }
  side: Side
}

/** The rectangle a step lights up: its target element, trimmed by the step's inset. */
function targetRect(step: Step): DOMRect | null {
  const el = findTarget(step)
  if (!el) return null
  const r = el.getBoundingClientRect()
  const i = step.inset
  if (!i) return r
  const left = r.left + (i.left ?? 0)
  const top = r.top + (i.top ?? 0)
  return new DOMRect(left, top, Math.max(40, r.right - (i.right ?? 0) - left), Math.max(40, r.bottom - (i.bottom ?? 0) - top))
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
  // pulled the lit area out from under the card.
  //
  // This blocks the gestures that scroll (wheel, touch drag, scroll keys) rather than setting
  // overflow: hidden on the page. Hiding overflow also stops the tour's own scrolling here, because
  // the page's root elements are full-height: the document then has nowhere to scroll to.
  // Blocking the default action does not stop the events themselves, so the 3D Moon can still be
  // turned and zoomed, and the page still responds to clicks.
  useEffect(() => {
    // While touring, the overlays on the 3D panel (the ground card and the hint) are hidden, so the
    // step about the Moon shows the Moon and nothing else. See .touring in index.css.
    document.body.classList.add('touring')
    const stop = (e: Event) => e.preventDefault()
    const keys = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])
    const stopKeys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      // Leave typing and native controls alone (a select uses the arrow keys, a button uses space).
      if (el && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)) return
      if (keys.has(e.key)) e.preventDefault()
    }
    window.addEventListener('wheel', stop, { passive: false })
    window.addEventListener('touchmove', stop, { passive: false })
    window.addEventListener('keydown', stopKeys)
    return () => {
      document.body.classList.remove('touring')
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchmove', stop)
      window.removeEventListener('keydown', stopKeys)
    }
  }, [])

  // Each step, in order: the card fades out, the scene is set, the page glides to the area the step is
  // about with the spotlight travelling along, and only when it has arrived do the card and pointer
  // fade in. The card never moves while the page does, which is what used to make it jump about.
  useEffect(() => {
    setShown(false)
    step.setup(actions)
    let raf = 0
    let alive = true
    let lastKey = ''
    const measure = () => {
      if (!alive) return
      const rect = targetRect(step)
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
    // The page can keep shifting for a moment after arriving (data loading, sections resizing).
    const follow = () => {
      measure()
      raf = requestAnimationFrame(follow)
    }
    const arrive = () => {
      if (!alive) return
      measure()
      setShown(true)
      next.current?.focus({ preventScroll: true })
      follow()
    }
    /** Scroll position that puts the step's area in the middle of the window. */
    const destination = () => {
      const r = targetRect(step)
      if (!r) return window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      return Math.max(0, Math.min(window.scrollY + r.top + r.height / 2 - window.innerHeight / 2, max))
    }
    const glide = () => {
      if (!alive) return
      const from = window.scrollY
      const distance = Math.abs(destination() - from)
      if (reduced || distance < 4) {
        window.scrollTo(0, destination())
        raf = requestAnimationFrame(arrive)
        return
      }
      // Longer trips take longer, within limits, so near and far steps both feel unhurried.
      const duration = Math.min(1100, Math.max(450, 320 + distance * 0.45))
      const t0 = performance.now()
      const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
      const frame = (now: number) => {
        if (!alive) return
        const p = Math.min(1, (now - t0) / duration)
        // Re-aim every frame: the area can move while sections above it finish loading.
        window.scrollTo(0, from + (destination() - from) * ease(p))
        measure()
        raf = p < 1 ? requestAnimationFrame(frame) : requestAnimationFrame(arrive)
      }
      raf = requestAnimationFrame(frame)
    }
    // Give the outgoing card time to fade and the page time to react to the new scene.
    const settle = window.setTimeout(glide, 200)
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
    ? step.round
      ? { left: r.left - 2, top: r.top - 2, width: r.width + 4, height: r.height + 4 }
      : { left: r.left - PAD, top: r.top - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD }
    : null

  const number = String(i + 1).padStart(2, '0')

  return (
    <>
      {/* Dim everything except the lit area. Clicks pass through, so the page stays usable. */}
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40"
          style={{
            ...spot,
            borderRadius: step.round ? '9999px' : '16px',
            // A hairline, a soft halo, then the dark that covers the rest of the page.
            boxShadow: `0 0 0 1px rgba(160, 205, 245, ${0.9 * fade}), 0 0 28px 2px rgba(88, 166, 232, ${0.45 * fade}), 0 0 0 200vmax rgba(0, 0, 0, 0.72)`,
            transition: reduced ? 'none' : 'box-shadow 260ms var(--ease-smooth)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/70" />
      )}

      {arrow && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" style={{ opacity: fade, transition: fadeTransition }}>
          {/* Keyed by step so the line draws itself once each time a step appears. */}
          <g key={i} className={reduced ? undefined : 'tour-arrow'}>
            <path d={arrow.d} pathLength={1} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="5" strokeLinecap="round" />
            <path d={arrow.d} pathLength={1} fill="none" stroke="#bfe0fb" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g key={`head-${i}`} className={reduced ? undefined : 'tour-arrow-head'}>
            <g transform={`translate(${arrow.tip[0]} ${arrow.tip[1]}) rotate(${arrow.angle})`}>
              <path d="M-12 -6 L0 0 L-12 6" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M-12 -6 L0 0 L-12 6" fill="none" stroke="#bfe0fb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </svg>
      )}

      <aside
        ref={card}
        role="dialog"
        aria-label={`Guided tour, step ${i + 1} of ${STEPS.length}`}
        className="tour-glass fixed z-50 overflow-hidden rounded-[22px]"
        style={{
          width: cardW,
          left: layout?.card.left ?? 16,
          top: layout?.card.top ?? 16,
          opacity: fade,
          transform: visible || reduced ? 'none' : 'translateY(10px) scale(0.985)',
          pointerEvents: visible ? 'auto' : 'none',
          transition: reduced ? 'none' : 'opacity 260ms var(--ease-smooth), transform 360ms var(--ease-smooth)',
        }}
      >
        {/* Progress along the top edge: one segment per step. */}
        <div className="flex gap-1 px-6 pt-5" role="img" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.map((_, k) => (
            <span key={k} className={`h-[3px] flex-1 rounded-full ${k <= i ? 'bg-white/85' : 'bg-white/18'}`} />
          ))}
        </div>

        <div className="px-6 pb-5 pt-4">
          <div className="flex items-start justify-between gap-4">
            <span className="tour-numeral display num select-none" aria-hidden>
              {number}
            </span>
            <button
              className="mt-1 rounded-full px-2.5 py-1 text-xs text-white/60 transition-colors duration-(--dur-fast) hover:bg-white/10 hover:text-white"
              onClick={close}
            >
              Skip the tour
            </button>
          </div>
          <h2 className="display mt-1 text-[1.3rem] leading-[1.2] text-white">{step.title}</h2>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-white/80">{step.body}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              className="rounded-full px-3 py-2 text-sm text-white/70 transition-colors duration-(--dur-fast) hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={() => setI((v) => v - 1)}
              disabled={i === 0}
            >
              Back
            </button>
            <button
              ref={next}
              className="tour-next rounded-full px-6 py-2.5 text-sm font-semibold"
              onClick={() => (last ? close() : setI((v) => v + 1))}
            >
              {last ? 'Finish the tour' : 'Next'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
