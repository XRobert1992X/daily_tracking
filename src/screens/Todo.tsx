import { useState } from 'react'
import { BarChart } from '../components/charts'
import PeriodBoard from '../components/PeriodBoard'
import { Header, Seg, Stat } from '../components/ui'
import { PERIOD_NAMES } from '../goals'
import type { AppData } from '../goals'
import { addDays, dayKey, lastDays, shortDate, weekKeys } from '../stats'
import type { Goal, Period, Topic } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onToggle: (id: string) => void
  onAdd: (title: string, period: Period, offset: 0 | 1) => void
  onDelete: (id: string) => void
  onCarry: (id: string) => void
  onOpenTopic: (t: Topic) => void
  onBack: () => void
}

type Tab = Period | 'archiv'

export default function Todo(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<Tab>('day')

  return (
    <main className="app">
      <Header title="ToDo" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'day', label: PERIOD_NAMES.day.short },
          { id: 'week', label: PERIOD_NAMES.week.short },
          { id: 'month', label: PERIOD_NAMES.month.short },
          { id: 'year', label: PERIOD_NAMES.year.short },
          { id: 'archiv', label: 'Archiv' },
        ]}
      />

      {tab === 'archiv' ? (
        <Archive data={data} onToggle={props.onToggle} />
      ) : (
        <>
          <PeriodBoard
            period={tab}
            data={data}
            goals={goals}
            editable
            onToggle={props.onToggle}
            onAdd={props.onAdd}
            onDelete={props.onDelete}
            onCarry={props.onCarry}
            onOpenTopic={props.onOpenTopic}
          />
          <p className="hint pad">
            Ziele aus den Themen (z. B. Meditation oder Lesen) legst du im jeweiligen Thema unter
            „Ziele“ an. Sie erscheinen hier automatisch mit deinem Fortschritt.
          </p>
        </>
      )}
    </main>
  )
}

function Archive({ data, onToggle }: { data: AppData; onToggle: (id: string) => void }) {
  const done = data.todos.filter((t) => t.done && t.doneAt)
  const doneDay = (t: (typeof done)[number]) => dayKey(new Date(t.doneAt!))
  const perDay = new Map<string, number>()
  for (const t of done) perDay.set(doneDay(t), (perDay.get(doneDay(t)) ?? 0) + 1)

  const week = new Set(weekKeys())
  const doneWeek = done.filter((t) => week.has(doneDay(t))).length
  // Anteil der ToDos aus abgeschlossenen Zeiträumen, die erledigt wurden
  const today = dayKey(new Date())
  const closed = data.todos.filter((t) => {
    const end = endOf(t.period, t.start)
    return end < today
  })
  const rate = closed.length ? Math.round((closed.filter((t) => t.done).length / closed.length) * 100) : null

  const groups = new Map<string, typeof done>()
  for (const t of [...done].sort((a, b) => b.doneAt!.localeCompare(a.doneAt!)).slice(0, 80)) {
    const k = doneDay(t)
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const yesterday = dayKey(addDays(new Date(), -1))
  const title = (k: string) =>
    k === today
      ? 'Heute'
      : k === yesterday
        ? 'Gestern'
        : new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          })

  return (
    <>
      <div className="stats">
        <Stat label="Erledigt gesamt" value={String(done.length)} />
        <Stat label="Diese Woche" value={String(doneWeek)} />
        <Stat label="Quote" value={rate === null ? '–' : `${rate} %`} />
      </div>
      <p className="hint tight-hint">Quote: erledigte ToDos aus bereits abgelaufenen Zeiträumen</p>

      <section className="card">
        <p className="muted">Erledigt pro Tag (14 Tage)</p>
        <BarChart
          data={lastDays(14).map((k) => ({ key: k, value: perDay.get(k) ?? 0, label: shortDate(k) }))}
        />
      </section>

      <section className="card tight">
        <p className="muted">Erledigte ToDos</p>
        {done.length === 0 && <p className="hint">Noch nichts erledigt.</p>}
        {[...groups].map(([day, list]) => (
          <div key={day} className="daygroup">
            <div className="dayhead">
              <b>{title(day)}</b>
              <small className="muted">{list.length}</small>
            </div>
            <ul className="todos">
              {list.map((t) => (
                <li key={t.id} className="todo done">
                  <button className="todo-check" aria-label="Als offen markieren" onClick={() => onToggle(t.id)}>
                    ✓
                  </button>
                  <span className="todo-title">
                    {t.title}
                    <em className="when">{PERIOD_NAMES[t.period].short}</em>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  )
}

// Letzter Tag eines Zeitraums, der bei start beginnt
function endOf(period: Period, start: string) {
  const s = new Date(`${start}T12:00:00`)
  if (period === 'day') return start
  if (period === 'week') return dayKey(addDays(s, 6))
  if (period === 'month') return dayKey(new Date(s.getFullYear(), s.getMonth() + 1, 0))
  return dayKey(new Date(s.getFullYear(), 11, 31))
}
