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
import type { Goal, Topic, TodoPeriod } from '../types'
import { RowPhotos } from './Attach'
import { ProgressBar, Ring, MiniRing, WeekDots } from './ui'
import { addDays, dayKey, todayKey } from '../stats'

interface Props {
  period: TodoPeriod
  data: AppData
  goals: Goal[]
  editable?: boolean
  onToggle: (id: string) => void
  onBump: (id: string, delta: 1 | -1) => void
  onAdd: (title: string, period: TodoPeriod, offset: 0 | 1, target?: number, due?: string) => void
  onOpenTopic?: (t: Topic) => void
  onDelete?: (id: string) => void
  onCarry?: (id: string) => void
}

// "heute", "morgen", "in 5 Tagen" bzw. "überfällig seit 2 Tagen"
function dueLabel(due: string) {
  const diff = Math.round(
    (new Date(`${due}T12:00:00`).getTime() - new Date(`${todayKey()}T12:00:00`).getTime()) / 86_400_000,
  )
  const date = new Date(`${due}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
  if (diff < 0) return { text: `überfällig seit ${-diff} ${-diff === 1 ? 'Tag' : 'Tagen'} (${date})`, tone: 'late' }
  if (diff === 0) return { text: 'heute fällig', tone: 'soon' }
  if (diff === 1) return { text: `morgen (${date})`, tone: 'soon' }
  return { text: `in ${diff} Tagen (${date})`, tone: diff <= 3 ? 'soon' : 'when' }
}

export default function PeriodBoard({
  period,
  data,
  goals,
  editable,
  onToggle,
  onBump,
  onAdd,
  onOpenTopic,
  onDelete,
  onCarry,
}: Props) {
  const [text, setText] = useState('')
  const [offset, setOffset] = useState<0 | 1>(0)
  const [type, setType] = useState<'check' | 'count'>('check')
  const [targetText, setTargetText] = useState('4')
  const [due, setDue] = useState(() => dayKey(addDays(new Date(), 1)))
  const targetNum = parseInt(targetText, 10)
  const isDl = period === 'deadline'
  const countValid = type === 'check' || (targetNum >= 2 && targetNum <= 999)

  const cur = isDl ? todayKey() : periodStartKey(period)
  const todos = data.todos.filter((t) => t.period === period)
  const current = isDl ? [] : todos.filter((t) => t.start === cur)
  const overdue = isDl ? [] : todos.filter((t) => t.start < cur && !t.done)
  const planned = isDl ? [] : todos.filter((t) => t.start > cur)
  const evals = isDl
    ? []
    : goals.filter((g) => g.period === period).map((g) => ({ g, ev: evaluateGoal(g, data) }))

  // Deadlines: alle offenen nach Datum, dazu die in den letzten 7 Tagen erledigten
  const dlOpen = todos.filter((t) => !t.done).sort((a, b) => a.start.localeCompare(b.start))
  const dlDone = todos.filter(
    (t) => t.done && t.doneAt && Date.now() - Date.parse(t.doneAt) < 7 * 86_400_000,
  )
  const open = isDl ? dlOpen : [...overdue, ...current.filter((t) => !t.done)]
  const done = isDl ? dlDone : current.filter((t) => t.done)
  const total = open.length + done.length + evals.length
  const doneCount = done.length + evals.filter((e) => e.ev.status === 'done').length

  const message =
    total === 0
      ? 'Noch nichts geplant'
      : doneCount === total
        ? 'Alles erledigt'
        : `${total - doneCount} noch offen`

  const row = (t: (typeof todos)[number], late: boolean) => {
    const isCount = (t.target ?? 0) > 1
    const count = t.count ?? 0
    const target = t.target ?? 1
    return (
      <li key={t.id} className={`todo ${isCount ? 'counting' : ''} ${t.done ? 'done' : ''}`}>
        {isCount ? (
          <MiniRing value={count} max={target} done={t.done} />
        ) : (
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
        )}
        <div className="todo-main">
          <span className="todo-title">
            {t.title}
            {isDl && !t.done
              ? (() => {
                  const d = dueLabel(t.start)
                  return <em className={d.tone}>{d.text}</em>
                })()
              : late && <em className="late">überfällig</em>}
          </span>
          {isCount &&
            (target <= 12 ? (
              <div className="segs" aria-hidden>
                {Array.from({ length: target }, (_, i) => (
                  <i key={i} className={i < count ? 'on' : ''} />
                ))}
              </div>
            ) : (
              <span className="bar mini">
                <i style={{ width: `${Math.min(100, (count / target) * 100)}%` }} />
              </span>
            ))}
        </div>
        {isCount && (
          <div className="count-actions">
            {count > 0 && (
              <button className="step minus" aria-label="Eins zurück" onClick={() => onBump(t.id, -1)}>
                −
              </button>
            )}
            {t.done ? (
              <span className="done-badge" aria-label="Erledigt">
                ✓
              </span>
            ) : (
              <button
                className="step plus"
                aria-label={`Hochzählen (${count} von ${target})`}
                onClick={() => {
                  navigator.vibrate?.(12)
                  onBump(t.id, 1)
                }}
              >
                +
              </button>
            )}
          </div>
        )}
        {editable && <RowPhotos ownerId={t.id} />}
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
  }

  return (
    <>
      <section className="card board-head">
        <Ring done={doneCount} total={total} />
        <div className="board-text">
          <b>{PERIOD_NAMES[period].now}</b>
          <small className="muted">{periodSubtitle(period, data)}</small>
          <span className={`board-msg ${total > 0 && doneCount === total ? 'ok' : ''}`}>
            {message}
          </span>
        </div>
      </section>

      <section className="card tight">
        <form
          className="addform"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() && countValid && (!isDl || due)) {
              onAdd(
                text.trim(),
                period,
                offset,
                type === 'count' ? targetNum : undefined,
                isDl ? due : undefined,
              )
              setText('')
            }
          }}
        >
          <div className="addrow">
            <input
              type="text"
              value={text}
              placeholder="Was willst du erreichen?"
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="addbtn"
              type="submit"
              aria-label="Hinzufügen"
              disabled={!text.trim() || !countValid}
            >
              +
            </button>
          </div>
          <div className="addopts">
            <div className="mini-seg" role="group" aria-label="Typ">
              <button
                type="button"
                className={type === 'check' ? 'on' : ''}
                onClick={() => setType('check')}
              >
                Abhaken
              </button>
              <button
                type="button"
                className={type === 'count' ? 'on' : ''}
                onClick={() => setType('count')}
              >
                Zählen
              </button>
            </div>
            {type === 'count' && (
              <label className="target-in">
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={999}
                  value={targetText}
                  aria-label="Zielanzahl"
                  onChange={(e) => setTargetText(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <span className="muted">×</span>
              </label>
            )}
            {isDl ? (
              <label className="due-in">
                <span className="muted">Bis</span>
                <input
                  type="date"
                  value={due}
                  min={todayKey()}
                  aria-label="Deadline"
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            ) : (
              editable && (
                <select
                  aria-label="Zeitraum"
                  value={offset}
                  onChange={(e) => setOffset(e.target.value === '1' ? 1 : 0)}
                >
                  <option value="0">{PERIOD_NAMES[period].now}</option>
                  <option value="1">{PERIOD_NAMES[period].next}</option>
                </select>
              )
            )}
          </div>
        </form>

        {open.length + done.length === 0 && (
          <p className="hint">Noch keine ToDos. Schreibe auf, was du in diesem Zeitraum schaffen willst.</p>
        )}
        <ul className="todos">
          {isDl ? (
            <>
              {dlOpen.map((t) => row(t, false))}
              {dlDone.map((t) => row(t, false))}
            </>
          ) : (
            <>
              {overdue.map((t) => row(t, true))}
              {current.filter((t) => !t.done).map((t) => row(t, false))}
              {done.map((t) => row(t, false))}
            </>
          )}
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
                  {(t.target ?? 0) > 1 && <em className="when">{t.target}×</em>}
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
