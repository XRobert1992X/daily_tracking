import { fmtNum, goalTitle } from '../goals'
import type { AppData, DuePenalty } from '../goals'
import { usePenalties } from '../penalty'

const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

// Offene Strafen mit "Erledigt"-Knopf
export function PenaltyList({ due, data }: { due: DuePenalty[]; data: AppData }) {
  const penalties = usePenalties()
  return (
    <ul className="penalties">
      {due.map((p) => (
        <li key={p.id}>
          <div className="pen-text">
            <b>
              {p.goal.penalty?.text}
              {p.goal.penalty?.amount ? <em>{eur(p.goal.penalty.amount)}</em> : null}
            </b>
            <small className="muted">
              {goalTitle(p.goal, data.habits)} · {p.label} verfehlt ({fmtNum(p.value)}/{fmtNum(p.goal.target)})
            </small>
          </div>
          <button
            className="mini-btn"
            onClick={() =>
              penalties.upsert({
                id: p.id,
                goalId: p.goal.id,
                start: p.start,
                doneAt: new Date().toISOString(),
              })
            }
          >
            Erledigt
          </button>
        </li>
      ))}
    </ul>
  )
}
