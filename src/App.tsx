import { useEffect, useState } from 'react'

const STORAGE_KEY = 'progress:checkins'

function loadCheckins(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function dayKey(d: Date) {
  return d.toLocaleDateString('sv-SE')
}

function streak(days: string[]) {
  const set = new Set(days)
  let n = 0
  const d = new Date()
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (set.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

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

export default function App() {
  const [days, setDays] = useState(loadCheckins)
  const online = useOnline()
  const today = dayKey(new Date())
  const done = days.includes(today)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days))
  }, [days])

  const toggle = () =>
    setDays((prev) =>
      prev.includes(today) ? prev.filter((d) => d !== today) : [...prev, today],
    )

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { key: dayKey(d), label: d.toLocaleDateString('de-DE', { weekday: 'narrow' }) }
  })

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

      <section className="card hero">
        <p className="muted">Aktuelle Serie</p>
        <div className="streak">
          {streak(days)}
          <small> Tage</small>
        </div>
        <button className={`cta ${done ? 'done' : ''}`} onClick={toggle}>
          {done ? '✓ Heute erledigt' : 'Heute einchecken'}
        </button>
      </section>

      <section className="card">
        <p className="muted">Letzte 7 Tage</p>
        <div className="week">
          {last7.map((d) => (
            <div key={d.key} className="day">
              <span className={`dot ${days.includes(d.key) ? 'full' : ''}`} />
              <small>{d.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card info">
        <p className="muted">PWA-Status</p>
        <ul>
          <li>
            <span>Als App installiert</span>
            <b className={standalone ? 'ok' : ''}>{standalone ? 'Ja' : 'Nein'}</b>
          </li>
          <li>
            <span>Check-ins gespeichert</span>
            <b>{days.length}</b>
          </li>
        </ul>
        {!standalone && (
          <p className="hint">
            Safari → Teilen-Symbol → „Zum Home-Bildschirm“, um die App zu
            installieren.
          </p>
        )}
      </section>
    </main>
  )
}
