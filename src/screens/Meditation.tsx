import { useState } from 'react'
import { unlockAudio } from '../audio'
import { RowPhotos } from '../components/Attach'
import { BarChart, Heatmap } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import TimerScreen from '../components/TimerScreen'
import { DurationPicker, Header, Seg, Stat, parseMinutes } from '../components/ui'
import type { AppData } from '../goals'
import { clearActive, loadActive, saveActive } from '../storage'
import { avgRate10, dayKey, dayStreak, fmtClock, shortDate, sum, trend10 } from '../stats'
import {
  DEFAULT_MINUTES,
  DEFAULT_TYPE,
  MEDITATION_TYPES,
  MINUTE_OPTIONS,
  typeLabel,
} from '../types'
import type { ActiveSession, FinishedSession, Goal, MeditationSession } from '../types'
import DoneScreen from './Done'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (s: MeditationSession) => void
  onDelete: (id: string) => void
  onBack: () => void
}

type Phase =
  | { name: 'menu' }
  | { name: 'run'; active: ActiveSession }
  | { name: 'done'; result: FinishedSession; id: string }

export default function Meditation({
  data,
  goals,
  onUpsertGoal,
  onRemoveGoal,
  onSave,
  onDelete,
  onBack,
}: Props) {
  const [tab, setTab] = useState<'start' | 'verlauf' | 'ziele'>('start')
  const [phase, setPhase] = useState<Phase>(() => {
    const a = loadActive()
    return a ? { name: 'run', active: a } : { name: 'menu' }
  })

  if (phase.name === 'run') {
    const a = phase.active
    return (
      <TimerScreen
        title={typeLabel(a.type)}
        startedAt={a.startedAt}
        plannedMin={a.plannedMin}
        initialCount={a.interruptions}
        countLabel="Abgeschweift · tippen"
        onCount={(n) => saveActive({ ...a, interruptions: n })}
        earlyConfirm="Meditation vorzeitig beenden und speichern?"
        cancelConfirm="Meditation verwerfen? Es wird nichts gespeichert."
        onFinish={(r) => {
          clearActive()
          setPhase({
            name: 'done',
            id: crypto.randomUUID(),
            result: {
              startedAt: a.startedAt,
              plannedMin: a.plannedMin,
              type: a.type,
              interruptions: r.count,
              actualSec: r.actualSec,
              completed: r.completed,
            },
          })
        }}
        onCancel={() => {
          clearActive()
          setPhase({ name: 'menu' })
        }}
      />
    )
  }

  if (phase.name === 'done') {
    const r = phase.result
    return (
      <DoneScreen
        completed={r.completed}
        subtitle={`${typeLabel(r.type)} · ${fmtClock(r.actualSec)} Min`}
        question="Wie oft bist du abgeschweift?"
        initial={r.interruptions}
        ownerId={phase.id}
        onSave={(interruptions) => {
          onSave({
            id: phase.id,
            startedAt: new Date(r.startedAt).toISOString(),
            plannedMin: r.plannedMin,
            actualSec: r.actualSec,
            type: r.type,
            interruptions,
            completed: r.completed,
          })
          setPhase({ name: 'menu' })
        }}
        onDiscard={() => setPhase({ name: 'menu' })}
      />
    )
  }

  return (
    <main className="app">
      <Header title="Meditation" onBack={onBack} />
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
          onStart={(type, plannedMin) => {
            unlockAudio()
            const a: ActiveSession = { startedAt: Date.now(), plannedMin, type, interruptions: 0 }
            saveActive(a)
            setPhase({ name: 'run', active: a })
          }}
        />
      )}
      {tab === 'verlauf' && <History sessions={data.meditation} onDelete={onDelete} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="meditation"
          data={data}
          goals={goals}
          onUpsert={onUpsertGoal}
          onRemove={onRemoveGoal}
        />
      )}
    </main>
  )
}

function Setup({ onStart }: { onStart: (type: string, min: number) => void }) {
  const [type, setType] = useState(DEFAULT_TYPE)
  const [text, setText] = useState(String(DEFAULT_MINUTES))
  const minutes = parseMinutes(text)

  return (
    <>
      <section className="card">
        <label className="field">
          <span className="muted">Art der Meditation</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {MEDITATION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <DurationPicker
          label="Dauer in Minuten"
          text={text}
          onText={setText}
          options={MINUTE_OPTIONS}
        />
      </section>

      <button className="cta" disabled={!minutes} onClick={() => onStart(type, minutes)}>
        {minutes ? `▶ ${minutes} Min starten` : '▶ Starten'}
      </button>
    </>
  )
}

function History({
  sessions,
  onDelete,
}: {
  sessions: MeditationSession[]
  onDelete: (id: string) => void
}) {
  const counted = sessions.map((s) => ({ count: s.interruptions, sec: s.actualSec }))
  const t = trend10(counted)
  const better = t.recent !== null && t.previous !== null && t.recent < t.previous
  const worse = t.recent !== null && t.previous !== null && t.recent > t.previous
  const minutes = new Map<string, number>()
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt))
    minutes.set(k, (minutes.get(k) ?? 0) + s.actualSec / 60)
  }
  const overall = avgRate10(counted)

  return (
    <>
      <div className="stats">
        <Stat label="Sitzungen" value={String(sessions.length)} />
        <Stat label="Serie (Tage)" value={String(dayStreak(new Set(minutes.keys())))} />
        <Stat label="Minuten" value={String(Math.round(sum(sessions.map((s) => s.actualSec)) / 60))} />
      </div>

      <section className="card">
        <p className="muted">Unterbrechungen pro Sitzung</p>
        {sessions.length === 0 ? (
          <p className="hint">Noch keine Sitzungen. Starte deine erste Meditation.</p>
        ) : (
          <>
            <BarChart
              trend
              data={sessions.slice(-20).map((s) => ({
                key: s.id,
                value: s.interruptions,
                label: shortDate(dayKey(new Date(s.startedAt))),
              }))}
            />
            <p className="trend">
              <b>{t.recent === null ? '–' : t.recent.toFixed(1)}</b>
              <span className="muted"> pro 10 Min (letzte 5)</span>
              {t.previous !== null && (
                <span className={better ? 'ok' : worse ? 'bad' : 'muted'}>
                  {' '}
                  {better ? '▼ besser' : worse ? '▲ mehr' : '= gleich'} (vorher{' '}
                  {t.previous.toFixed(1)})
                </span>
              )}
            </p>
          </>
        )}
      </section>

      <section className="card">
        <p className="muted">Letzte 5 Wochen</p>
        <Heatmap values={minutes} level={(v) => (v === 0 ? 0 : v < 10 ? 1 : v < 20 ? 2 : 3)} />
      </section>

      <section className="card">
        <p className="muted">Alle Sitzungen</p>
        <ul className="list">
          {[...sessions].reverse().map((s) => {
            const d = new Date(s.startedAt)
            const r = s.actualSec >= 60 ? s.interruptions / (s.actualSec / 600) : null
            return (
              <li key={s.id}>
                <div>
                  <b>{typeLabel(s.type)}</b>
                  <small className="muted">
                    {d.toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {Math.round(s.actualSec / 60)}/{s.plannedMin} Min
                    {r !== null && ` · ${r.toFixed(1)}/10 Min`}
                  </small>
                </div>
                <RowPhotos ownerId={s.id} />
                <span className="chip">{s.interruptions}×</span>
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Sitzung löschen?') && onDelete(s.id)}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
        {overall !== null && (
          <p className="hint">Ø {overall.toFixed(1)} Unterbrechungen pro 10 Min</p>
        )}
      </section>
    </>
  )
}
