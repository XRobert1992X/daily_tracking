import { useState } from 'react'
import {
  PERIOD_NAMES,
  STATUS_LABEL,
  evaluateGoal,
  fmtNum,
  goalTitle,
  goalUnit,
  periodStartKey,
  periodSubtitle,
} from '../goals'
import type { AppData } from '../goals'
import type { Goal, Period, Topic } from '../types'
import { ProgressBar, Ring, WeekDots } from './ui'

interface Props {
  period: Period
  data: AppData
  goals: Goal[]
  editable?: boolean
  onToggle: (id: string) => void
  onAdd: (title: string, period: Period, offset: 0 | 1) => void
  onOpenTopic?: (t: Topic) => void
  onDelete?: (id: string) => void
  onCarry?: (id: string) => void
}

export default function PeriodBoard({
  period,
  data,
  goals,
  editable,
  onToggle,
  onAdd,
  onOpenTopic,
  onDelete,
  onCarry,
}: Props) {
  const [text, setText] = useState('')
  const [offset, setOffset] = useState<0 | 1>(0)

  const cur = periodStartKey(period)
  const todos = data.todos.filter((t) => t.period === period)
  const current = todos.filter((t) => t.start === cur)
  const overdue = todos.filter((t) => t.start < cur && !t.done)
  const planned = todos.filter((t) => t.start > cur)
  const evals = goals
    .filter((g) => g.period === period)
    .map((g) => ({ g, ev: evaluateGoal(g, data) }))

  const open = [...overdue, ...current.filter((t) => !t.done)]
  const done = current.filter((t) => t.done)
  const total = open.length + done.length + evals.length
  const doneCount = done.length + evals.filter((e) => e.ev.status === 'done').length

  const message =
    total === 0
      ? 'Noch nichts geplant'
      : doneCount === total
        ? 'Alles erledigt'
        : `${total - doneCount} noch offen`

  const row = (t: (typeof todos)[number], late: boolean) => (
    <li key={t.id} className={`todo ${t.done ? 'done' : ''}`}>
      <button
        className="todo-check"
        aria-label={t.done ? 'Als offen markieren' : 'Als erledigt markieren'}
        onClick={() => {
          navigator.vibrate?.(t.done ? 0 : 12)
          onToggle(t.id)
        }}
      >
        {t.done ? '✓' : ''}
      </button>
      <span className="todo-title">
        {t.title}
        {late && <em className="late">überfällig</em>}
      </span>
      {editable && late && onCarry && (
        <button className="x" aria-label="In aktuellen Zeitraum übernehmen" onClick={() => onCarry(t.id)}>
          ↻
        </button>
      )}
      {editable && onDelete && (
        <button
          className="x"
          aria-label="ToDo löschen"
          onClick={() => confirm('ToDo löschen?') && onDelete(t.id)}
        >
          ✕
        </button>
      )}
    </li>
  )

  return (
    <>
      <section className="card board-head">
        <Ring done={doneCount} total={total} />
        <div className="board-text">
          <b>{PERIOD_NAMES[period].now}</b>
          <small className="muted">{periodSubtitle(period)}</small>
          <span className={`board-msg ${total > 0 && doneCount === total ? 'ok' : ''}`}>
            {message}
          </span>
        </div>
      </section>

      <section className="card tight">
        <form
          className="addrow"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) {
              onAdd(text.trim(), period, offset)
              setText('')
            }
          }}
        >
          <input
            type="text"
            value={text}
            placeholder="Was willst du erreichen?"
            onChange={(e) => setText(e.target.value)}
          />
          {editable && (
            <select
              aria-label="Zeitraum"
              value={offset}
              onChange={(e) => setOffset(e.target.value === '1' ? 1 : 0)}
            >
              <option value="0">{PERIOD_NAMES[period].now}</option>
              <option value="1">{PERIOD_NAMES[period].next}</option>
            </select>
          )}
          <button className="addbtn" type="submit" aria-label="Hinzufügen" disabled={!text.trim()}>
            +
          </button>
        </form>

        {open.length + done.length === 0 && (
          <p className="hint">Noch keine ToDos. Schreibe auf, was du in diesem Zeitraum schaffen willst.</p>
        )}
        <ul className="todos">
          {overdue.map((t) => row(t, true))}
          {current.filter((t) => !t.done).map((t) => row(t, false))}
          {done.map((t) => row(t, false))}
        </ul>
      </section>

      {evals.length > 0 && (
        <section className="card tight">
          <p className="muted">Ziele aus den Themen</p>
          <ul className="goals-list">
            {evals.map(({ g, ev }) => (
              <li key={g.id}>
                <button
                  className="goalrow"
                  onClick={() => onOpenTopic?.(g.topic)}
                  disabled={!onOpenTopic}
                >
                  <div className="goalrow-top">
                    <b>{goalTitle(g, data.habits)}</b>
                    <span className={`status ${ev.status}`}>{STATUS_LABEL[ev.status]}</span>
                  </div>
                  <ProgressBar value={ev.current} max={ev.target} />
                  {ev.weekDays && <WeekDots days={ev.weekDays} />}
                  <small className="muted">
                    {fmtNum(ev.current)} / {fmtNum(ev.target)} {goalUnit(g)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editable && planned.length > 0 && (
        <section className="card tight">
          <p className="muted">Geplant für später</p>
          <ul className="todos">
            {planned.map((t) => (
              <li key={t.id} className="todo planned">
                <span className="todo-dot" />
                <span className="todo-title">
                  {t.title}
                  <em className="when">
                    {new Date(`${t.start}T12:00:00`).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </em>
                </span>
                {onDelete && (
                  <button
                    className="x"
                    aria-label="ToDo löschen"
                    onClick={() => confirm('ToDo löschen?') && onDelete(t.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
