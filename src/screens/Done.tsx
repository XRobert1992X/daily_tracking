import { useState } from 'react'
import { cancelScheduled } from '../audio'
import { Stepper } from '../components/ui'

interface Props {
  completed: boolean
  subtitle: string
  question: string
  initial: number
  onSave: (count: number) => void
  onDiscard: () => void
}

export default function DoneScreen({
  completed,
  subtitle,
  question,
  initial,
  onSave,
  onDiscard,
}: Props) {
  const [count, setCount] = useState(initial)

  return (
    <main className="app session">
      <p className="muted center">{completed ? 'Geschafft' : 'Vorzeitig beendet'}</p>
      <h1 className="center big">{completed ? '🔔 Zeit ist um' : 'Sitzung beendet'}</h1>

      <section className="card center">
        <p className="muted">{subtitle}</p>
        <p className="muted question">{question}</p>
        <Stepper value={count} onChange={setCount} />
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
