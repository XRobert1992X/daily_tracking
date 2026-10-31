import { useState } from 'react'
import { cancelScheduled, unlockAudio } from '../audio'
import { BarChart } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import TimerScreen from '../components/TimerScreen'
import { DurationPicker, Header, Seg, Stat, Stepper, parseMinutes } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, fmtClock, lastDays, shortDate, sum, todayKey, trend10, weekKeys } from '../stats'
import type { FocusSession, Goal } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (s: FocusSession) => void
  onDelete: (id: string) => void
  onBack: () => void
}

interface PomoCfg {
  focus: number
  short: number
  long: number
  rounds: number
}

type PomoPhase = 'focus' | 'short' | 'long'

interface PomoState {
  phase: PomoPhase
  startedAt: number
  plannedMin: number
  round: number
  count: number
  task: string
  cfg: PomoCfg
}

type View =
  | { name: 'menu' }
  | { name: 'run'; s: PomoState }
  | { name: 'focusdone'; s: PomoState; session: FocusSession }
  | { name: 'breakdone'; s: PomoState }

const STATE_KEY = 'progress:pomo'
const CFG_KEY = 'progress:pomo-cfg'
const DEFAULT_CFG: PomoCfg = { focus: 25, short: 5, long: 15, rounds: 4 }

function loadCfg(): PomoCfg {
  try {
    return { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}') }
  } catch {
    return DEFAULT_CFG
  }
}

export function hasPomoRunning() {
  return localStorage.getItem(STATE_KEY) !== null
}

function loadState(): PomoState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? (JSON.parse(raw) as PomoState) : null
  } catch {
    return null
  }
}

const saveState = (s: PomoState) => localStorage.setItem(STATE_KEY, JSON.stringify(s))
const clearState = () => localStorage.removeItem(STATE_KEY)

export default function Focus(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'start' | 'verlauf' | 'ziele'>('start')
  const [view, setView] = useState<View>(() => {
    const s = loadState()
    return s ? { name: 'run', s } : { name: 'menu' }
  })

  const begin = (s: PomoState) => {
    unlockAudio()
    saveState(s)
    setView({ name: 'run', s })
  }

  if (view.name === 'run') {
    const s = view.s
    const isFocus = s.phase === 'focus'
    return (
      <TimerScreen
        key={s.startedAt}
        title={
          isFocus
            ? `${s.task || 'Fokus'} · Runde ${s.round}/${s.cfg.rounds}`
            : s.phase === 'long'
              ? 'Lange Pause'
              : 'Kurze Pause'
        }
        startedAt={s.startedAt}
        plannedMin={s.plannedMin}
        initialCount={s.count}
        countLabel={isFocus ? 'Ablenkung · tippen' : undefined}
        onCount={(n) => saveState({ ...s, count: n })}
        rest={!isFocus}
        earlyLabel={isFocus ? 'Früher beenden' : 'Pause überspringen'}
        earlyConfirm={isFocus ? 'Fokus-Block vorzeitig beenden und speichern?' : undefined}
        cancelLabel={isFocus ? 'Abbrechen' : 'Beenden'}
        cancelConfirm={
          isFocus ? 'Fokus-Block verwerfen? Es wird nichts gespeichert.' : undefined
        }
        onFinish={(r) => {
          if (isFocus) {
            const session: FocusSession = {
              id: `focus-${s.startedAt}`,
              startedAt: new Date(s.startedAt).toISOString(),
              plannedMin: s.plannedMin,
              actualSec: r.actualSec,
              task: s.task,
              distractions: r.count,
              completed: r.completed,
            }
            props.onSave(session)
            setView({ name: 'focusdone', s, session })
          } else {
            setView({ name: 'breakdone', s })
          }
        }}
        onCancel={() => {
          clearState()
          setView({ name: 'menu' })
        }}
      />
    )
  }

  if (view.name === 'focusdone') {
    const { s, session } = view
    const long = s.round % s.cfg.rounds === 0
    const breakMin = long ? s.cfg.long : s.cfg.short
    return (
      <FocusDone
        session={session}
        breakLabel={`${long ? 'Lange Pause' : 'Pause'} starten (${breakMin} Min)`}
        onChange={(n) => {
          const next = { ...session, distractions: n }
          props.onSave(next)
          setView({ name: 'focusdone', s, session: next })
        }}
        onBreak={() => {
          cancelScheduled()
          begin({
            phase: long ? 'long' : 'short',
            startedAt: Date.now(),
            plannedMin: breakMin,
            round: s.round,
            count: 0,
            task: s.task,
            cfg: s.cfg,
          })
        }}
        onEnd={() => {
          cancelScheduled()
          clearState()
          setView({ name: 'menu' })
        }}
      />
    )
  }

  if (view.name === 'breakdone') {
    const s = view.s
    const nextRound = s.phase === 'long' ? 1 : s.round + 1
    return (
      <main className="app session">
        <p className="muted center">Pause vorbei</p>
        <h1 className="center big">☕ Weiter geht’s</h1>
        <button
          className="cta"
          onClick={() => {
            cancelScheduled()
            begin({
              phase: 'focus',
              startedAt: Date.now(),
              plannedMin: s.cfg.focus,
              round: nextRound,
              count: 0,
              task: s.task,
              cfg: s.cfg,
            })
          }}
        >
          ▶ Runde {nextRound} starten ({s.cfg.focus} Min)
        </button>
        <button
          className="ghost"
          onClick={() => {
            cancelScheduled()
            clearState()
            setView({ name: 'menu' })
          }}
        >
          Beenden
        </button>
      </main>
    )
  }

  return (
    <main className="app">
      <Header title="Fokus" onBack={onBack} />
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
          onStart={(task, cfg) => {
            localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
            begin({
              phase: 'focus',
              startedAt: Date.now(),
              plannedMin: cfg.focus,
              round: 1,
              count: 0,
              task,
              cfg,
            })
          }}
        />
      )}
      {tab === 'verlauf' && <History sessions={data.focus} onDelete={props.onDelete} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="focus"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function FocusDone({
  session,
  breakLabel,
  onChange,
  onBreak,
  onEnd,
}: {
  session: FocusSession
  breakLabel: string
  onChange: (n: number) => void
  onBreak: () => void
  onEnd: () => void
}) {
  return (
    <main className="app session">
      <p className="muted center">{session.completed ? 'Geschafft' : 'Vorzeitig beendet'}</p>
      <h1 className="center big">{session.completed ? '🔔 Block fertig' : 'Block beendet'}</h1>
      <section className="card center">
        <p className="muted">
          {session.task || 'Fokus'} · {fmtClock(session.actualSec)} Min · gespeichert
        </p>
        <p className="muted question">Wie oft wurdest du abgelenkt?</p>
        <Stepper value={session.distractions} onChange={onChange} />
      </section>
      <button className="cta" onClick={onBreak}>
        ☕ {breakLabel}
      </button>
      <button className="ghost" onClick={onEnd}>
        Fertig für jetzt
      </button>
    </main>
  )
}

function Setup({ onStart }: { onStart: (task: string, cfg: PomoCfg) => void }) {
  const initial = loadCfg()
  const [task, setTask] = useState('')
  const [focus, setFocus] = useState(String(initial.focus))
  const [short, setShort] = useState(String(initial.short))
  const [long, setLong] = useState(String(initial.long))
  const [rounds, setRounds] = useState(String(initial.rounds))

  const cfg: PomoCfg = {
    focus: parseMinutes(focus, 180),
    short: parseMinutes(short, 60),
    long: parseMinutes(long, 120),
    rounds: parseInt(rounds, 10),
  }
  const valid = cfg.focus > 0 && cfg.short > 0 && cfg.long > 0

  return (
    <>
      <section className="card">
        <label className="field">
          <span className="muted">Woran arbeitest du? (optional)</span>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="z. B. Steuererklärung"
          />
        </label>
        <DurationPicker
          label="Fokus (Minuten)"
          text={focus}
          onText={setFocus}
          options={[15, 20, 25, 30, 45, 50, 60]}
          max={180}
        />
        <DurationPicker
          label="Kurze Pause (Minuten)"
          text={short}
          onText={setShort}
          options={[3, 5, 10, 15]}
          max={60}
        />
        <DurationPicker
          label="Lange Pause (Minuten)"
          text={long}
          onText={setLong}
          options={[10, 15, 20, 30]}
          max={120}
        />
        <label className="field">
          <span className="muted">Runden bis zur langen Pause</span>
          <select value={rounds} onChange={(e) => setRounds(e.target.value)}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} Runden
              </option>
            ))}
          </select>
        </label>
      </section>

      <button className="cta" disabled={!valid} onClick={() => onStart(task.trim(), cfg)}>
        {valid ? `▶ Fokus starten (${cfg.focus} Min)` : '▶ Starten'}
      </button>
    </>
  )
}

function History({
  sessions,
  onDelete,
}: {
  sessions: FocusSession[]
  onDelete: (id: string) => void
}) {
  const byDay = new Map<string, { min: number; blocks: number }>()
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt))
    const e = byDay.get(k) ?? { min: 0, blocks: 0 }
    e.min += s.actualSec / 60
    e.blocks += 1
    byDay.set(k, e)
  }
  const today = byDay.get(todayKey())
  const weekMin = sum(weekKeys().map((k) => byDay.get(k)?.min ?? 0))
  const t = trend10(sessions.map((s) => ({ count: s.distractions, sec: s.actualSec })))
  const better = t.recent !== null && t.previous !== null && t.recent < t.previous
  const worse = t.recent !== null && t.previous !== null && t.recent > t.previous

  return (
    <>
      <div className="stats">
        <Stat label="Blöcke heute" value={String(today?.blocks ?? 0)} />
        <Stat label="Min heute" value={String(Math.round(today?.min ?? 0))} />
        <Stat label="Min Woche" value={String(Math.round(weekMin))} />
      </div>

      <section className="card">
        <p className="muted">Fokus-Minuten pro Tag (14 Tage)</p>
        <BarChart
          data={lastDays(14).map((k) => ({
            key: k,
            value: Math.round(byDay.get(k)?.min ?? 0),
            label: shortDate(k),
          }))}
        />
        {t.recent !== null && (
          <p className="trend">
            <b>{t.recent.toFixed(1)}</b>
            <span className="muted"> Ablenkungen pro 10 Min (letzte 5)</span>
            {t.previous !== null && (
              <span className={better ? 'ok' : worse ? 'bad' : 'muted'}>
                {' '}
                {better ? '▼ besser' : worse ? '▲ mehr' : '= gleich'} (vorher {t.previous.toFixed(1)})
              </span>
            )}
          </p>
        )}
      </section>

      <section className="card">
        <p className="muted">Alle Blöcke</p>
        {sessions.length === 0 && <p className="hint">Noch keine Fokus-Blöcke.</p>}
        <ul className="list">
          {[...sessions].reverse().map((s) => {
            const d = new Date(s.startedAt)
            return (
              <li key={s.id}>
                <div>
                  <b>{s.task || 'Fokus'}</b>
                  <small className="muted">
                    {d.toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {Math.round(s.actualSec / 60)}/{s.plannedMin} Min
                  </small>
                </div>
                <span className="chip">{s.distractions}×</span>
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Block löschen?') && onDelete(s.id)}
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
