import { useEffect, useRef, useState } from 'react'
import { ProgressBar } from '../components/ui'
import { STATUS_LABEL, evaluateGoal, fmtNum, goalTitle, metricDef } from '../goals'
import type { AppData } from '../goals'
import { dayStreak, dayKey, sum, todayKey, weekKeys } from '../stats'
import type { Goal, Topic } from '../types'

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

interface Props {
  data: AppData
  goals: Goal[]
  onOpen: (t: Topic) => void
  onExport: () => void
  onImport: (file: File) => Promise<string>
}

export default function Home({ data, goals, onOpen, onExport, onImport }: Props) {
  const online = useOnline()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const today = todayKey()
  const week = new Set(weekKeys())
  const dayOf = (iso: string) => dayKey(new Date(iso))

  const medWeek = data.meditation.filter((s) => week.has(dayOf(s.startedAt))).length
  const medStreak = dayStreak(new Set(data.meditation.map((s) => dayOf(s.startedAt))))
  const readToday = sum(data.readingLogs.filter((l) => l.day === today).map((l) => l.minutes))
  const habitsToday = data.habitLogs.filter((l) => l.day === today && l.count > 0).length
  const lastMood = data.moods[data.moods.length - 1]
  const focusToday = data.focus.filter((s) => dayOf(s.startedAt) === today)
  const socialWeek = data.social.filter((e) => week.has(dayOf(e.at)))
  const approachWeek = socialWeek.filter((e) => e.kind === 'approach').length
  const datesWeek = socialWeek.filter((e) => e.kind === 'date').length

  const topics: { id: Topic; icon: string; name: string; info: string }[] = [
    {
      id: 'meditation',
      icon: '🧘',
      name: 'Meditation',
      info: data.meditation.length ? `${medWeek}× diese Woche · Serie ${medStreak} Tage` : 'Noch keine Sitzung',
    },
    {
      id: 'reading',
      icon: '📖',
      name: 'Lesen',
      info: data.books.some((b) => !b.finishedAt)
        ? `${readToday} Min heute · ${data.books.filter((b) => !b.finishedAt).length} Buch aktuell`
        : 'Noch kein Buch',
    },
    {
      id: 'habits',
      icon: '✅',
      name: 'Gewohnheiten',
      info: data.habits.length ? `${habitsToday} von ${data.habits.length} heute aktiv` : 'Noch keine Gewohnheit',
    },
    {
      id: 'mood',
      icon: '🙂',
      name: 'Stimmung & Energie',
      info: lastMood ? `Zuletzt: Stimmung ${lastMood.mood} · Energie ${lastMood.energy}` : 'Noch kein Check-in',
    },
    {
      id: 'focus',
      icon: '🍅',
      name: 'Fokus',
      info: focusToday.length
        ? `${focusToday.length} ${focusToday.length === 1 ? 'Block' : 'Blöcke'} · ${Math.round(sum(focusToday.map((s) => s.actualSec)) / 60)} Min heute`
        : 'Pomodoro-Timer',
    },
    {
      id: 'social',
      icon: '💬',
      name: 'Soziale Interaktion',
      info: data.social.length
        ? `${approachWeek}× angesprochen · ${datesWeek} ${datesWeek === 1 ? 'Date' : 'Dates'} diese Woche`
        : 'Noch kein Eintrag',
    },
  ]

  const evals = goals.map((g) => ({ g, ev: evaluateGoal(g, data) }))

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

      {evals.length > 0 && (
        <>
          <p className="muted section">Ziele</p>
          <section className="card">
            <ul className="list goals">
              {evals.map(({ g, ev }) => (
                <li key={g.id}>
                  <button className="goalrow" onClick={() => onOpen(g.topic)}>
                    <div className="goalrow-top">
                      <b>{goalTitle(g, data.habits)}</b>
                      <span className={`status ${ev.status}`}>{STATUS_LABEL[ev.status]}</span>
                    </div>
                    <ProgressBar value={ev.current} max={ev.target} />
                    <small className="muted">
                      {fmtNum(ev.current)} / {fmtNum(ev.target)} {metricDef(g).unit}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <p className="muted section">Themen</p>
      {topics.map((t) => (
        <button key={t.id} className="topic" onClick={() => onOpen(t.id)}>
          <span className="topic-icon">{t.icon}</span>
          <span className="topic-body">
            <b>{t.name}</b>
            <small className="muted">{t.info}</small>
          </span>
          <span className="chev">›</span>
        </button>
      ))}

      <p className="muted section">Backup</p>
      <section className="card">
        <div className="row">
          <button className="ghost" onClick={onExport}>
            Exportieren
          </button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            Importieren
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setMsg(await onImport(f))
          }}
        />
        {msg && <p className="hint">{msg}</p>}
        <p className="hint">
          Alle Daten liegen nur auf diesem Gerät. Exportiere regelmäßig ein Backup.
        </p>
      </section>
    </main>
  )
}
