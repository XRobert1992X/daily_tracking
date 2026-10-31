import { useState } from 'react'
import { Heatmap } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, ProgressBar, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, habitDayDone, habitStreak, todayKey, weekKeys } from '../stats'
import type { Goal, Habit, HabitKind, HabitLog } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onUpsertHabit: (h: Habit) => void
  onRemoveHabit: (id: string) => void
  onUpsertLog: (l: HabitLog) => void
  onRemoveLog: (id: string) => void
  onBack: () => void
}

const ICONS = ['✅', '🚀', '🧹', '🥗', '🏃', '💧', '📵', '🛏️', '📚', '🧠', '🧘', '☀️']

const SUGGESTIONS: { name: string; icon: string; kind: HabitKind; target: number; hint: string }[] = [
  {
    name: 'Just Do It',
    icon: '🚀',
    kind: 'count',
    target: 3,
    hint: 'Zähle jedes Mal, wenn du sofort anfängst, statt aufzuschieben.',
  },
  { name: 'Aufräumen', icon: '🧹', kind: 'check', target: 3, hint: '3 Tage pro Woche' },
  { name: 'Gut ernähren', icon: '🥗', kind: 'check', target: 7, hint: 'Jeden Tag' },
  { name: 'Bewegung', icon: '🏃', kind: 'check', target: 4, hint: '4 Tage pro Woche' },
]

type View = { name: 'list' } | { name: 'add' } | { name: 'detail'; id: string }

export default function Habits(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'heute' | 'ziele'>('heute')
  const [view, setView] = useState<View>({ name: 'list' })

  const logs = new Map<string, Map<string, number>>()
  for (const l of data.habitLogs) {
    const m = logs.get(l.habitId) ?? new Map<string, number>()
    m.set(l.day, l.count)
    logs.set(l.habitId, m)
  }

  const setCount = (h: Habit, day: string, n: number) => {
    const id = `${h.id}:${day}`
    if (n <= 0) props.onRemoveLog(id)
    else props.onUpsertLog({ id, habitId: h.id, day, count: n })
  }

  if (view.name === 'add') {
    return (
      <AddHabit
        onBack={() => setView({ name: 'list' })}
        onSave={(h) => {
          props.onUpsertHabit(h)
          setView({ name: 'list' })
        }}
      />
    )
  }

  const detail = view.name === 'detail' ? data.habits.find((h) => h.id === view.id) : undefined
  if (detail) {
    return (
      <Detail
        habit={detail}
        byDay={logs.get(detail.id) ?? new Map()}
        onBack={() => setView({ name: 'list' })}
        onChangeTarget={(target) => props.onUpsertHabit({ ...detail, target })}
        onDelete={() => {
          props.onRemoveHabit(detail.id)
          setView({ name: 'list' })
        }}
      />
    )
  }

  const today = todayKey()
  const week = weekKeys()
  const doneToday = data.habits.filter((h) =>
    habitDayDone(h, logs.get(h.id)?.get(today) ?? 0),
  ).length

  return (
    <main className="app">
      <Header title="Gewohnheiten" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'heute', label: 'Heute' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />

      {tab === 'ziele' && (
        <GoalsPanel
          topic="habits"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}

      {tab === 'heute' && (
        <>
          {data.habits.length > 0 && (
            <section className="card">
              <p className="muted">Heute erledigt</p>
              <p className="goal-num">
                <b>{doneToday}</b>
                <span className="muted"> / {data.habits.length}</span>
              </p>
              <ProgressBar value={doneToday} max={data.habits.length} />
            </section>
          )}

          {data.habits.map((h) => {
            const byDay = logs.get(h.id) ?? new Map<string, number>()
            const todayCount = byDay.get(today) ?? 0
            const weekDone = week.filter((k) => (byDay.get(k) ?? 0) >= 1).length
            const streak = habitStreak(h, byDay)
            const isDone = habitDayDone(h, todayCount)
            return (
              <section key={h.id} className={`card habit ${isDone ? 'done' : ''}`}>
                <div className="habit-top">
                  <button className="habit-name" onClick={() => setView({ name: 'detail', id: h.id })}>
                    <span className="habit-icon">{h.icon}</span>
                    <span className="habit-text">
                      <b>{h.name}</b>
                      <small className="muted">
                        {h.kind === 'check'
                          ? `${weekDone}/${h.target} diese Woche`
                          : `Heute ${todayCount}/${h.target}`}
                        {streak.n > 0 && ` · 🔥 ${streak.n} ${streak.unit}`}
                      </small>
                    </span>
                  </button>
                  {h.kind === 'check' ? (
                    <button
                      className={`check ${todayCount >= 1 ? 'on' : ''}`}
                      aria-label="Heute erledigt"
                      onClick={() => setCount(h, today, todayCount >= 1 ? 0 : 1)}
                    >
                      ✓
                    </button>
                  ) : (
                    <div className="stepper small">
                      <button onClick={() => setCount(h, today, todayCount - 1)} aria-label="Weniger">
                        −
                      </button>
                      <span>{todayCount}</span>
                      <button onClick={() => setCount(h, today, todayCount + 1)} aria-label="Mehr">
                        +
                      </button>
                    </div>
                  )}
                </div>
                <div className="weekdots">
                  {week.map((k, i) => {
                    const c = byDay.get(k) ?? 0
                    const future = k > today
                    return (
                      <button
                        key={k}
                        disabled={future || h.kind === 'count'}
                        className={`wd ${c > 0 ? 'on' : ''} ${k === today ? 'today' : ''}`}
                        onClick={() => setCount(h, k, c >= 1 ? 0 : 1)}
                        aria-label={k}
                      >
                        <span>{h.kind === 'count' && c > 0 ? c : ''}</span>
                        <small>{['M', 'D', 'M', 'D', 'F', 'S', 'S'][i]}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {data.habits.length === 0 && (
            <section className="card">
              <p className="muted">Noch keine Gewohnheit</p>
              <p className="hint">
                Lege deine erste Gewohnheit an, zum Beispiel „Just Do It“ gegen Prokrastination oder
                „Aufräumen“.
              </p>
            </section>
          )}

          <button className="ghost wide" onClick={() => setView({ name: 'add' })}>
            + Gewohnheit hinzufügen
          </button>
        </>
      )}
    </main>
  )
}

function AddHabit({ onBack, onSave }: { onBack: () => void; onSave: (h: Habit) => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('✅')
  const [kind, setKind] = useState<HabitKind>('check')
  const [target, setTarget] = useState('3')
  const t = parseInt(target, 10)
  const valid = name.trim() !== '' && t >= 1 && t <= (kind === 'check' ? 7 : 99)

  return (
    <main className="app">
      <Header title="Neue Gewohnheit" onBack={onBack} />

      <section className="card">
        <p className="muted">Vorschläge</p>
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.name}
              className="chipbtn"
              onClick={() => {
                setName(s.name)
                setIcon(s.icon)
                setKind(s.kind)
                setTarget(String(s.target))
              }}
            >
              {s.icon} {s.name}
            </button>
          ))}
        </div>
        <p className="hint">
          „Just Do It“ ist ein Zähler: Du tippst jedes Mal auf +, wenn du ins Machen gekommen bist,
          statt zu prokrastinieren.
        </p>
      </section>

      <section className="card">
        <label className="field">
          <span className="muted">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="muted">Symbol</span>
          <select value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="muted">Art</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as HabitKind)}
          >
            <option value="check">Ja/Nein pro Tag (Wochenziel)</option>
            <option value="count">Zähler pro Tag (Tagesziel)</option>
          </select>
        </label>
        <label className="field">
          <span className="muted">
            {kind === 'check' ? 'Ziel: Tage pro Woche (1–7)' : 'Ziel: Anzahl pro Tag'}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={kind === 'check' ? 7 : 99}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
      </section>

      <button
        className="cta"
        disabled={!valid}
        onClick={() =>
          onSave({
            id: crypto.randomUUID(),
            name: name.trim(),
            icon,
            kind,
            target: t,
            createdAt: new Date().toISOString(),
          })
        }
      >
        Speichern
      </button>
    </main>
  )
}

function Detail({
  habit,
  byDay,
  onBack,
  onChangeTarget,
  onDelete,
}: {
  habit: Habit
  byDay: Map<string, number>
  onBack: () => void
  onChangeTarget: (t: number) => void
  onDelete: () => void
}) {
  const streak = habitStreak(habit, byDay)
  const total = [...byDay.values()].filter((c) => habitDayDone(habit, c)).length
  const monthPrefix = dayKey(new Date()).slice(0, 7)
  const month = [...byDay].filter(([k, c]) => k.startsWith(monthPrefix) && c > 0).length

  return (
    <main className="app">
      <Header title={`${habit.icon} ${habit.name}`} onBack={onBack} />

      <div className="stats">
        <Stat label={`Serie (${streak.unit})`} value={String(streak.n)} />
        <Stat label="Tage gesamt" value={String(total)} />
        <Stat label="Diesen Monat" value={String(month)} />
      </div>

      <section className="card">
        <p className="muted">Letzte 8 Wochen</p>
        <Heatmap
          weeks={8}
          values={byDay}
          level={(v) =>
            v === 0
              ? 0
              : habit.kind === 'check' || v >= habit.target
                ? 3
                : v >= habit.target / 2
                  ? 2
                  : 1
          }
        />
      </section>

      <section className="card">
        <label className="field">
          <span className="muted">
            {habit.kind === 'check' ? 'Ziel: Tage pro Woche' : 'Ziel: Anzahl pro Tag'}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={habit.kind === 'check' ? 7 : 99}
            defaultValue={habit.target}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (v >= 1 && v <= (habit.kind === 'check' ? 7 : 99)) onChangeTarget(v)
            }}
          />
        </label>
      </section>

      <button
        className="ghost danger wide"
        onClick={() => confirm('Gewohnheit samt Verlauf löschen?') && onDelete()}
      >
        Gewohnheit löschen
      </button>
    </main>
  )
}
