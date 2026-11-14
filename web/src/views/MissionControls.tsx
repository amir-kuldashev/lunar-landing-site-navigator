import { LENGTHS, PRIORITIES, type Mission } from '../lib/scoring'

/** Mission length and priority. One setting for the whole page: every ranking view shows and changes the same one. */
export default function MissionControls({ mission, onChange }: { mission: Mission; onChange: (m: Mission) => void }) {
  const toggle = (active: boolean) => `btn min-h-8! text-xs! ${active ? 'btn-primary' : ''}`
  return (
    <>
      <div className="flex items-center gap-1.5" role="group" aria-label="Mission length">
        <span>Mission length</span>
        {LENGTHS.map((l) => (
          <button
            key={l.days}
            className={toggle(mission.days === l.days)}
            aria-pressed={mission.days === l.days}
            onClick={() => onChange({ ...mission, days: l.days })}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Priority">
        <span>Priority</span>
        {PRIORITIES.map((p) => (
          <button
            key={p.id}
            className={toggle(mission.priority === p.id)}
            aria-pressed={mission.priority === p.id}
            onClick={() => onChange({ ...mission, priority: p.id })}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  )
}
