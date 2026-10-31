import { useState } from 'react'
import { cancelScheduled } from '../audio'
import { fmtClock } from '../stats'
import { typeLabel } from '../types'
import type { FinishedSession } from '../types'

interface Props {
  result: FinishedSession
  onSave: (interruptions: number) => void
  onDiscard: () => void
}

export default function DoneScreen({ result, onSave, onDiscard }: Props) {
  const [count, setCount] = useState(result.interruptions)

  return (
    <main className="app session">
      <p className="muted center">
        {result.completed ? 'Geschafft' : 'Vorzeitig beendet'}
      </p>
      <h1 className="center big">
        {result.completed ? '🔔 Zeit ist um' : 'Sitzung beendet'}
      </h1>

      <section className="card center">
        <p className="muted">
          {typeLabel(result.type)} · {fmtClock(result.actualSec)} Min
        </p>
        <p className="muted question">Wie oft bist du abgeschweift?</p>
        <div className="stepper">
          <button onClick={() => setCount((c) => Math.max(0, c - 1))} aria-label="Weniger">
            −
          </button>
          <span>{count}</span>
          <button onClick={() => setCount((c) => c + 1)} aria-label="Mehr">
            +
          </button>
        </div>
      </section>

      <button
        className="cta"
        onClick={() => {
          cancelScheduled()
          onSave(count)
        }}
      >
        Speichern
      </button>
      <button
        className="ghost danger"
        onClick={() => {
          if (confirm('Sitzung nicht speichern?')) {
            cancelScheduled()
            onDiscard()
          }
        }}
      >
        Verwerfen
      </button>
    </main>
  )
}
