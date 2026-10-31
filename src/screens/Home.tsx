import { useEffect, useState } from 'react'
import { streak } from '../stats'
import type { MeditationSession } from '../types'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export default function Home({
  sessions,
  onOpenMeditation,
}: {
  sessions: MeditationSession[]
  onOpenMeditation: () => void
}) {
  const online = useOnline()
  const weekAgo = Date.now() - 7 * 86_400_000
  const thisWeek = sessions.filter((s) => new Date(s.startedAt).getTime() >= weekAgo).length

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="muted">
            {new Date().toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1>Progress</h1>
        </div>
        <span className={`pill ${online ? 'on' : 'off'}`}>
          <i /> {online ? 'Online' : 'Offline'}
        </span>
      </header>

      <p className="muted section">Themen</p>

      <button className="topic" onClick={onOpenMeditation}>
        <span className="topic-icon">🧘</span>
        <span className="topic-body">
          <b>Meditation</b>
          <small className="muted">
            {sessions.length === 0
              ? 'Noch keine Sitzung'
              : `${thisWeek}× diese Woche · Serie ${streak(sessions)} Tage`}
          </small>
        </span>
        <span className="chev">›</span>
      </button>

      <div className="topic soon">
        <span className="topic-icon">＋</span>
        <span className="topic-body">
          <b>Weitere Themen</b>
          <small className="muted">folgen später</small>
        </span>
      </div>
    </main>
  )
}
