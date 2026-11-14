import type { Events, Interval, Summary, Topo } from '../core'
import { compass, deg, duration } from '../lib/format'

/** Where the Sun and Earth are right now, how long that lasts, and the 30-day picture. */

function nextChange(list: Interval[], t: number): { on: boolean; at: number | null } {
  for (const i of list) {
    if (t >= i.start && t < i.end) return { on: true, at: i.openEnd ? null : i.end }
    if (i.start > t) return { on: false, at: i.start }
  }
  return { on: false, at: null }
}

function Body({
  name,
  color,
  el,
  az,
  status,
  good,
  countdownLabel,
  countdown,
  extra,
}: {
  name: string
  color: string
  el: number
  az: number
  status: string
  good: boolean
  countdownLabel: string
  countdown: string
  extra: string
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4" aria-label={name}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {name}
        </h2>
        <span className={`text-sm ${good ? 'text-ink' : 'text-warn'}`}>{status}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="display num text-4xl leading-none" style={{ color }}>
            {deg(Math.abs(el), 2)}
          </div>
          <div className="mt-1.5 text-xs text-muted">
            {el >= 0 ? 'above' : 'below'} the horizontal, toward {compass(az)} ({deg(az, 0)})
          </div>
        </div>
        <div className="text-right">
          <div className="num text-lg leading-tight">{countdown}</div>
          <div className="text-xs text-muted">{countdownLabel}</div>
        </div>
      </div>
      <div className="mt-3 border-t border-line pt-2.5 text-xs text-muted">{extra}</div>
    </section>
  )
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="num text-sm text-ink">{value.toFixed(0)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full origin-left rounded-full transition-transform duration-(--dur-normal) ease-(--ease-smooth) motion-reduce:transition-none"
          style={{ background: color, transform: `scaleX(${Math.max(value, 0.5) / 100})` }}
        />
      </div>
    </div>
  )
}

export default function Readouts({
  now,
  events,
  summary,
  days,
  windowEnd,
}: {
  now: Topo
  events: Events
  summary: Summary
  days: number
  windowEnd: number
}) {
  const sun = nextChange(events.sunlight, now.t)
  const earth = nextChange(events.dte, now.t)
  const beyond = `over ${Math.floor((windowEnd - now.t) / 86400000)} days`
  const lit = now.sun.visibleFraction

  // One plain-language sentence for people who do not read elevation angles.
  const sunLine = sun.on
    ? sun.at
      ? `The Sun is up and sets in ${duration(sun.at - now.t)}.`
      : 'The Sun is up and does not set for at least two months.'
    : sun.at
      ? `It is night here. The Sun rises in ${duration(sun.at - now.t)}.`
      : 'It is night here, and the Sun does not rise for at least two months.'
  const earthLine = earth.on
    ? earth.at
      ? `Earth is in view for another ${duration(earth.at - now.t)}, so the lander can talk to Earth directly.`
      : 'Earth stays in view, so the lander can always talk to Earth directly.'
    : earth.at
      ? `Earth is hidden for another ${duration(earth.at - now.t)}; until then the lander needs a relay satellite.`
      : 'Earth never comes into view from here, so the lander always needs a relay satellite.'

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed" role="status">
        {sunLine} {earthLine}
      </p>
      <Body
        name="Sun"
        color="var(--color-sun)"
        el={now.sun.el}
        az={now.sun.az}
        status={lit >= 0.995 ? 'Full sunlight' : lit > 0 ? `Partly hidden, ${(lit * 100).toFixed(0)}% of disk` : 'Night'}
        good={lit > 0}
        countdownLabel={sun.on ? 'until sunset' : 'until sunrise'}
        countdown={sun.at ? duration(sun.at - now.t) : beyond}
        extra={`Flat panel facing up gets ${(Math.max(0, Math.sin((now.sun.el * Math.PI) / 180)) * lit * 100).toFixed(0)}% of full power. A panel tracking the Sun gets ${(lit * 100).toFixed(0)}%.`}
      />
      <Body
        name="Earth"
        color="var(--color-earth)"
        el={now.earth.el}
        az={now.earth.az}
        status={now.earth.visible ? 'Direct link available' : 'No direct link'}
        good={now.earth.visible}
        countdownLabel={earth.on ? 'until Earthset' : 'until Earthrise'}
        countdown={earth.at ? duration(earth.at - now.t) : earth.on ? 'Does not set' : 'Does not rise'}
        extra={
          now.earth.visible
            ? `Earth sits ${deg(now.earth.el - now.earth.horizonEl, 1)} above the skyline in that direction.`
            : `Earth is ${deg(now.earth.horizonEl - now.earth.el, 1)} below the skyline. A relay satellite is needed.`
        }
      />
      <section className="rounded-xl border border-line bg-panel p-4" aria-label={`${days}-day outlook`}>
        <h2 className="text-sm font-medium">{days}-day outlook from the window start</h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <Meter label="Sunlit" value={summary.litPct} color="var(--color-sun)" />
          <Meter label="Earth in view" value={summary.dtePct} color="var(--color-earth)" />
          <Meter label="Both" value={summary.bothPct} color="var(--color-ink)" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Longest night</dt>
          <dd className="num text-right">{duration(summary.longestNight_h * 3600000)}</dd>
          <dt className="text-muted">Longest gap without Earth</dt>
          <dd className="num text-right">{duration(summary.longestDteGap_h * 3600000)}</dd>
          <dt className="text-muted">Highest Sun</dt>
          <dd className="num text-right">{deg(summary.maxSunEl)}</dd>
        </dl>
      </section>
    </div>
  )
}
