import { useEffect, useState } from 'react'
import { unlockAudio } from './audio'
import { clearActive, loadActive, useSessions } from './storage'
import DoneScreen from './screens/Done'
import Home from './screens/Home'
import Meditation from './screens/Meditation'
import SessionScreen from './screens/Session'
import type { ActiveSession, FinishedSession } from './types'

type Phase =
  | { name: 'home' }
  | { name: 'meditation' }
  | { name: 'session'; active: ActiveSession }
  | { name: 'done'; result: FinishedSession }

// Eine laufende Sitzung wird nach einem Neuladen der App fortgesetzt
function initialPhase(): Phase {
  const existing = loadActive()
  return existing ? { name: 'session', active: existing } : { name: 'home' }
}

export default function App() {
  const { sessions, add, remove, merge } = useSessions()
  const [phase, setPhase] = useState<Phase>(initialPhase)

  // Der erste Tipp schaltet den Ton frei (iOS verlangt eine Nutzergeste)
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  if (phase.name === 'session') {
    return (
      <SessionScreen
        active={phase.active}
        onFinish={(result) => {
          clearActive()
          setPhase({ name: 'done', result })
        }}
        onCancel={() => {
          clearActive()
          setPhase({ name: 'meditation' })
        }}
      />
    )
  }

  if (phase.name === 'done') {
    const r = phase.result
    return (
      <DoneScreen
        result={r}
        onSave={(interruptions) => {
          add({
            id: crypto.randomUUID(),
            startedAt: new Date(r.startedAt).toISOString(),
            plannedMin: r.plannedMin,
            actualSec: r.actualSec,
            type: r.type,
            interruptions,
            completed: r.completed,
          })
          setPhase({ name: 'meditation' })
        }}
        onDiscard={() => setPhase({ name: 'meditation' })}
      />
    )
  }

  if (phase.name === 'meditation') {
    return (
      <Meditation
        sessions={sessions}
        onBack={() => setPhase({ name: 'home' })}
        onDelete={remove}
        onImport={merge}
        onStart={(p) => {
          unlockAudio()
          setPhase({
            name: 'session',
            active: { startedAt: Date.now(), plannedMin: p.plannedMin, type: p.type, interruptions: 0 },
          })
        }}
      />
    )
  }

  return (
    <Home sessions={sessions} onOpenMeditation={() => setPhase({ name: 'meditation' })} />
  )
}
