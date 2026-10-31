import { useState } from 'react'
import {
  METRICS,
  PERIODS,
  STATUS_LABEL,
  evaluateGoal,
  fmtNum,
  goalTitle,
  metricDef,
} from '../goals'
import type { AppData } from '../goals'
import type { Goal, Period, Topic } from '../types'
import { ProgressBar } from './ui'

interface Props {
  topic: Topic
  data: AppData
  goals: Goal[]
  onUpsert: (g: Goal) => void
  onRemove: (id: string) => void
}

export function GoalCard({
  goal,
  data,
  onRemove,
}: {
  goal: Goal
  data: AppData
  onRemove?: (id: string) => void
}) {
  const ev = evaluateGoal(goal, data)
  const def = metricDef(goal)
  const period = PERIODS.find((p) => p.id === goal.period)
  const unit = ev.streak === 1 ? period?.singular : period?.plural
  return (
    <section className={`card goal ${ev.status}`}>
      <div className="goal-top">
        <b>{goalTitle(goal, data.habits)}</b>
        <span className={`status ${ev.status}`}>{STATUS_LABEL[ev.status]}</span>
        {onRemove && (
          <button
            className="x"
            aria-label="Ziel löschen"
            onClick={() => confirm('Ziel löschen?') && onRemove(goal.id)}
          >
            ✕
          </button>
        )}
      </div>
      <p className="goal-num">
        <b>{fmtNum(ev.current)}</b>
        <span className="muted">
          {' '}
          / {fmtNum(ev.target)} {def.unit}
        </span>
      </p>
      <ProgressBar value={ev.current} max={ev.target} />
      {ev.history.length > 1 && (
        <div className="hist" aria-label="Letzte Zeiträume">
          {ev.history.map((h, i) => (
            <div key={i} className={`hcol ${h.hit ? 'hit' : ''} ${h.current ? 'cur' : ''}`}>
              <div className="hbar">
                <i style={{ height: `${Math.min(100, (h.value / ev.target) * 100)}%` }} />
              </div>
              <small>{h.label}</small>
            </div>
          ))}
        </div>
      )}
      <p className="hint">
        {ev.streak > 0 ? `🔥 ${ev.streak} ${unit} in Folge` : 'Noch keine Serie'}
        {ev.rate !== null && ` · ${Math.round(ev.rate * 100)} % der Zeiträume erreicht`}
      </p>
    </section>
  )
}

const DEFAULT_TARGET: Record<Period, string> = { day: '1', week: '3', month: '10', year: '100' }

export default function GoalsPanel({ topic, data, goals, onUpsert, onRemove }: Props) {
  const metrics = METRICS[topic]
  const [adding, setAdding] = useState(false)
  const [metric, setMetric] = useState(metrics[0].id)
  const [period, setPeriod] = useState<Period>('week')
  const [habitId, setHabitId] = useState(data.habits[0]?.id ?? '')
  const [target, setTarget] = useState(DEFAULT_TARGET.week)

  const def = metrics.find((m) => m.id === metric) ?? metrics[0]
  const value = parseFloat(target.replace(',', '.'))
  const needsHabit = topic === 'habits'
  const valid = value > 0 && (!needsHabit || habitId !== '')

  const save = () => {
    onUpsert({
      id: crypto.randomUUID(),
      topic,
      metric,
      period,
      target: value,
      refId: needsHabit ? habitId : undefined,
      createdAt: new Date().toISOString(),
    })
    setAdding(false)
  }

  return (
    <>
      {goals.length === 0 && !adding && (
        <section className="card">
          <p className="muted">Noch keine Ziele</p>
          <p className="hint">
            Setze optional ein Ziel für einen Tag, eine Woche, einen Monat oder ein Jahr. Die App
            wertet deinen Fortschritt aus und zeigt dir, ob du im Plan bist.
          </p>
        </section>
      )}

      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} data={data} onRemove={onRemove} />
      ))}

      {adding ? (
        <section className="card">
          <p className="muted">Neues Ziel</p>
          {needsHabit && (
            <label className="field">
              <span className="muted">Gewohnheit</span>
              <select value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                {data.habits.length === 0 && <option value="">Zuerst eine Gewohnheit anlegen</option>}
                {data.habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.icon} {h.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {metrics.length > 1 && (
            <label className="field">
              <span className="muted">Was?</span>
              <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span className="muted">Zeitraum</span>
            <select
              value={period}
              onChange={(e) => {
                const p = e.target.value as Period
                setPeriod(p)
                setTarget(DEFAULT_TARGET[p])
              }}
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.per}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">Ziel{def.unit && ` (${def.unit})`}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="row">
            <button className="ghost" onClick={() => setAdding(false)}>
              Abbrechen
            </button>
            <button className="ghost primary" disabled={!valid} onClick={save}>
              Ziel speichern
            </button>
          </div>
        </section>
      ) : (
        <button
          className="ghost wide"
          onClick={() => {
            setMetric(metrics[0].id)
            setHabitId(data.habits[0]?.id ?? '')
            setAdding(true)
          }}
        >
          + Ziel hinzufügen
        </button>
      )}
    </>
  )
}
