import { useState } from 'react'
import { cancelScheduled, unlockAudio } from '../audio'
import { Attach, RowPhotos } from '../components/Attach'
import { BarChart, Heatmap } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import TimerScreen from '../components/TimerScreen'
import { Header, Meter, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, dayStreak, fmtClock, shortDate, sum } from '../stats'
import { COLD_DEFAULT_SEC, COLD_PRESETS } from '../types'
import type { ColdShower, Goal } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (s: ColdShower) => void
  onDelete: (id: string) => void
  onBack: () => void
}

interface Finished {
  startedAt: number
  plannedSec: number
  actualSec: number
  completed: boolean
}

type Phase =
  | { name: 'menu' }
  | { name: 'run'; startedAt: number; plannedSec: number }
  | { name: 'done'; id: string; result: Finished }

const SEC_KEY = 'progress:cold-sec'
const EFFORT_WORDS = [
  'locker',
  'leicht',
  'okay',
  'etwas zäh',
  'fordernd',
  'zäh',
  'hart',
  'sehr hart',
  'kaum auszuhalten',
  'extrem',
]

const secLabel = (s: number) =>
  s < 60 ? `${s} Sek` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Min`

function loadSec() {
  const n = parseInt(localStorage.getItem(SEC_KEY) ?? '', 10)
  return n >= 5 && n <= 1800 ? n : COLD_DEFAULT_SEC
}

export default function Cold({ data, goals, onUpsertGoal, onRemoveGoal, onSave, onDelete, onBack }: Props) {
  const [tab, setTab] = useState<'start' | 'verlauf' | 'ziele'>('start')
  const [phase, setPhase] = useState<Phase>({ name: 'menu' })
  const [sec, setSec] = useState(loadSec)

  const changeSec = (n: number) => {
    setSec(n)
    if (n >= 5 && n <= 1800) localStorage.setItem(SEC_KEY, String(n))
  }

  if (phase.name === 'run') {
    const { startedAt, plannedSec } = phase
    return (
      <TimerScreen
        title="Kalte Dusche"
        startedAt={startedAt}
        plannedMin={plannedSec / 60}
        earlyConfirm="Kalte Dusche vorzeitig beenden und speichern?"
        cancelConfirm="Verwerfen? Es wird nichts gespeichert."
        onFinish={(r) =>
          setPhase({
            name: 'done',
            id: crypto.randomUUID(),
            result: { startedAt, plannedSec, actualSec: r.actualSec, completed: r.completed },
          })
        }
        onCancel={() => setPhase({ name: 'menu' })}
      />
    )
  }

  if (phase.name === 'done') {
    return (
      <Done
        id={phase.id}
        result={phase.result}
        onSave={(effort, note) => {
          const r = phase.result
          onSave({
            id: phase.id,
            startedAt: new Date(r.startedAt).toISOString(),
            plannedSec: r.plannedSec,
            actualSec: r.actualSec,
            completed: r.completed,
            effort: effort || undefined,
            note: note.trim() || undefined,
          })
          setPhase({ name: 'menu' })
        }}
        onDiscard={() => setPhase({ name: 'menu' })}
      />
    )
  }

  return (
    <main className="app">
      <Header title="Kalte Dusche" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'start', label: 'Start' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'start' && (
        <Setup
          sec={sec}
          onSec={changeSec}
          onStart={() => {
            unlockAudio()
            setPhase({ name: 'run', startedAt: Date.now(), plannedSec: sec })
          }}
          onManual={(s) => {
            const done: Finished = { startedAt: Date.now() - s * 1000, plannedSec: s, actualSec: s, completed: true }
            setPhase({ name: 'done', id: crypto.randomUUID(), result: done })
          }}
        />
      )}
      {tab === 'verlauf' && <History sessions={data.cold} onDelete={onDelete} />}
      {tab === 'ziele' && (
        <GoalsPanel topic="cold" data={data} goals={goals} onUpsert={onUpsertGoal} onRemove={onRemoveGoal} />
      )}
    </main>
  )
}

function Setup({
  sec,
  onSec,
  onStart,
  onManual,
}: {
  sec: number
  onSec: (n: number) => void
  onStart: () => void
  onManual: (sec: number) => void
}) {
  const valid = sec >= 5 && sec <= 1800
  return (
    <>
      <section className="card">
        <p className="muted">Dauer</p>
        <div className="chips">
          {COLD_PRESETS.map((p) => (
            <button key={p} className={`chipbtn ${sec === p ? 'on' : ''}`} onClick={() => onSec(p)}>
              {secLabel(p)}
              {p === COLD_DEFAULT_SEC && ' ★'}
            </button>
          ))}
        </div>
        <label className="field spaced">
          <span className="muted">Eigene Dauer in Sekunden</span>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={1800}
            value={sec || ''}
            onChange={(e) => onSec(parseInt(e.target.value, 10) || 0)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <p className="hint">Standard: 1:30 Min. Am Ende ertönt ein Gong.</p>
      </section>

      <button className="cta" disabled={!valid} onClick={onStart}>
        {valid ? `▶ ${secLabel(sec)} starten` : '▶ Starten'}
      </button>
      <button className="ghost" disabled={!valid} onClick={() => onManual(sec)}>
        Schon geduscht? Ohne Timer eintragen
      </button>
    </>
  )
}

function Done({
  id,
  result,
  onSave,
  onDiscard,
}: {
  id: string
  result: Finished
  onSave: (effort: number, note: string) => void
  onDiscard: () => void
}) {
  const [effort, setEffort] = useState(0)
  const [note, setNote] = useState('')
  return (
    <main className="app session">
      <p className="muted center">{result.completed ? 'Geschafft' : 'Vorzeitig beendet'}</p>
      <h1 className="center big">{result.completed ? '🧊 Kalt geduscht' : 'Dusche beendet'}</h1>

      <section className="card">
        <p className="muted center">{fmtClock(result.actualSec)} Min</p>
        <p className="muted question center">Wie groß war die Überwindung?</p>
        <div className="scale-wrap">
          <Meter value={effort} max={10} onChange={setEffort} />
          <div className="scale-read">
            <b>
              {effort || '–'}
              <small>/10</small>
            </b>
            <small className="muted">{effort ? EFFORT_WORDS[effort - 1] : 'Optional'}</small>
          </div>
        </div>
        <label className="field">
          <span className="muted">Notiz (optional)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wie war es?" />
        </label>
        <Attach ownerId={id} />
      </section>

      <button
        className="cta"
        onClick={() => {
          cancelScheduled()
          onSave(effort, note)
        }}
      >
        Speichern
      </button>
      <button
        className="ghost danger"
        onClick={() => {
          if (confirm('Nicht speichern?')) {
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

function History({ sessions, onDelete }: { sessions: ColdShower[]; onDelete: (id: string) => void }) {
  const perDay = new Map<string, number>()
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt))
    perDay.set(k, (perDay.get(k) ?? 0) + 1)
  }
  const rated = sessions.filter((s) => s.effort)
  const avgEffort = rated.length ? sum(rated.map((s) => s.effort!)) / rated.length : null

  return (
    <>
      <div className="stats">
        <Stat label="Duschen" value={String(sessions.length)} />
        <Stat label="Serie (Tage)" value={String(dayStreak(new Set(perDay.keys())))} />
        <Stat label="Ø Überwindung" value={avgEffort === null ? '–' : avgEffort.toFixed(1)} />
      </div>

      <section className="card">
        <p className="muted">Dauer pro Dusche (Sekunden)</p>
        {sessions.length === 0 ? (
          <p className="hint">Noch keine kalte Dusche. Starte deine erste.</p>
        ) : (
          <BarChart
            trend
            data={sessions.slice(-20).map((s) => ({
              key: s.id,
              value: s.actualSec,
              label: shortDate(dayKey(new Date(s.startedAt))),
            }))}
          />
        )}
      </section>

      <section className="card">
        <p className="muted">Letzte 5 Wochen</p>
        <Heatmap values={perDay} level={(v) => (v === 0 ? 0 : v < 2 ? 2 : 3)} />
      </section>

      <section className="card">
        <p className="muted">Alle Duschen</p>
        <ul className="list">
          {[...sessions].reverse().map((s) => {
            const d = new Date(s.startedAt)
            return (
              <li key={s.id}>
                <div>
                  <b>{fmtClock(s.actualSec)} Min</b>
                  <small className="muted">
                    {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                    {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {s.effort ? ` · Überwindung ${s.effort}/10` : ''}
                    {s.completed ? '' : ' · vorzeitig'}
                    {s.note ? ` · ${s.note}` : ''}
                  </small>
                </div>
                <RowPhotos ownerId={s.id} />
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Eintrag löschen?') && onDelete(s.id)}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
