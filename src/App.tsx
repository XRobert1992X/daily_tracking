import { useEffect, useState } from 'react'
import { unlockAudio } from './audio'
import { clearActive, loadActive, useSessions } from './storage'
import DoneScreen from './screens/Done'
import Home from './screens/Home'
import Meditation from './screens/Meditation'
import type { Preset } from './screens/Meditation'
import SessionScreen from './screens/Session'
import {
  DEFAULT_MINUTES,
  DEFAULT_TYPE,
  MEDITATION_TYPES,
} from './types'
import type { ActiveSession, FinishedSession } from './types'

type Phase =
  | { name: 'home' }
  | { name: 'meditation'; preset?: Preset }
  | { name: 'session'; active: ActiveSession }
  | { name: 'done'; result: FinishedSession }

// Start-Link: ?start=meditation&type=atem-fokus&min=15&auto=1
function initialPhase(): Phase {
  const existing = loadActive()
  if (existing) return { name: 'session', active: existing }

  const q = new URLSearchParams(location.search)
  if (q.get('start') !== 'meditation') return { name: 'home' }

  const type = q.get('type') ?? DEFAULT_TYPE
  const min = parseInt(q.get('min') ?? '', 10)
  const preset: Preset = {
    type: MEDITATION_TYPES.some((t) => t.id === type) ? type : DEFAULT_TYPE,
    plannedMin: min >= 1 && min <= 240 ? min : DEFAULT_MINUTES,
  }
  if (q.get('auto') === '1') {
    return {
      name: 'session',
      active: { startedAt: Date.now(), plannedMin: preset.plannedMin, type: preset.type, interruptions: 0 },
    }
  }
  return { name: 'meditation', preset }
}

export default function App() {
  const { sessions, add, remove, merge } = useSessions()
  const [phase, setPhase] = useState<Phase>(initialPhase)

  useEffect(() => {
    if (location.search) history.replaceState(null, '', location.pathname)
  }, [])

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
        preset={phase.preset}
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
