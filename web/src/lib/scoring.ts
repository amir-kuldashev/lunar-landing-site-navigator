/**
 * How a landing option is scored. Shared by the site ranking, the south-pole map and the date finder,
 * so the same question always gets the same answer.
 *
 * Score (0 to 100) = wSolar * sunlight% + wDte * Earth-in-view% + wBoth * both-at-once%,
 * measured over the mission length from the landing time.
 */
export type Priority = 'balanced' | 'power' | 'comms'
export type Weights = [solar: number, dte: number, both: number]

export const PRIORITIES: { id: Priority; label: string; weights: Weights; blurb: string }[] = [
  { id: 'balanced', label: 'Balanced', weights: [0.3, 0.3, 0.4], blurb: 'sunlight 30%, Earth contact 30%, both at once 40%' },
  { id: 'power', label: 'Power first', weights: [0.6, 0.2, 0.2], blurb: 'sunlight 60%, Earth contact 20%, both at once 20%' },
  { id: 'comms', label: 'Contact first', weights: [0.2, 0.6, 0.2], blurb: 'sunlight 20%, Earth contact 60%, both at once 20%' },
]

export const LENGTHS = [
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
]

export const priorityOf = (id: Priority) => PRIORITIES.find((p) => p.id === id)!

/** The mission settings every ranking view shares. */
export interface Mission {
  days: number
  priority: Priority
}
