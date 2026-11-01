import { bedDiff, durationMin, wakeDiff } from './sleep'
import { addDays, dayKey, energy10, mood10, weekStart } from './stats'
import type {
  Book,
  ColdShower,
  DietEntry,
  FocusSession,
  Goal,
  GratitudeEntry,
  Habit,
  HabitLog,
  MeditationSession,
  MoodEntry,
  NoteEntry,
  Period,
  PenaltyLog,
  ReadingLog,
  SleepCfg,
  SleepEntry,
  SocialEntry,
  TodoItem,
  TodoPeriod,
  Topic,
  TradeEntry,
} from './types'

export interface AppData {
  meditation: MeditationSession[]
  books: Book[]
  readingLogs: ReadingLog[]
  habits: Habit[]
  habitLogs: HabitLog[]
  moods: MoodEntry[]
  focus: FocusSession[]
  social: SocialEntry[]
  todos: TodoItem[]
  diet: DietEntry[]
  trades: TradeEntry[]
  gratitude: GratitudeEntry[]
  cold: ColdShower[]
  sleep: SleepEntry[]
  penalties: PenaltyLog[]
  notes: NoteEntry[]
  // Täglicher Grundverbrauch in kcal
  dietTdee: number
  sleepCfg: SleepCfg
}

export interface MetricDef {
  id: string
  label: string
  unit: string
  agg: 'sum' | 'avg'
}

export const METRICS: Record<Topic, MetricDef[]> = {
  meditation: [
    { id: 'minutes', label: 'Minuten meditiert', unit: 'Min', agg: 'sum' },
    { id: 'sessions', label: 'Sitzungen', unit: '×', agg: 'sum' },
  ],
  reading: [
    { id: 'minutes', label: 'Minuten gelesen', unit: 'Min', agg: 'sum' },
    { id: 'pages', label: 'Seiten gelesen', unit: 'Seiten', agg: 'sum' },
    { id: 'books', label: 'Bücher beendet', unit: 'Bücher', agg: 'sum' },
  ],
  habits: [{ id: 'done', label: 'Erledigungen', unit: '×', agg: 'sum' }],
  mood: [
    { id: 'checkins', label: 'Check-ins', unit: '×', agg: 'sum' },
    { id: 'avgMood', label: 'Ø Stimmung', unit: '', agg: 'avg' },
    { id: 'avgEnergy', label: 'Ø Energie', unit: '', agg: 'avg' },
  ],
  focus: [
    { id: 'minutes', label: 'Fokus-Minuten', unit: 'Min', agg: 'sum' },
    { id: 'blocks', label: 'Fokus-Blöcke', unit: '×', agg: 'sum' },
  ],
  social: [
    { id: 'indirect', label: 'Indirekte Interaktionen', unit: '×', agg: 'sum' },
    { id: 'approach', label: 'Angesprochen', unit: '×', agg: 'sum' },
    { id: 'contact', label: 'Kontakt ausgetauscht', unit: '×', agg: 'sum' },
    { id: 'date', label: 'Dates', unit: '×', agg: 'sum' },
  ],
  diet: [
    { id: 'burned', label: 'Verbrannte kcal (Aktivität)', unit: 'kcal', agg: 'sum' },
    { id: 'deficit', label: 'Kalorien-Defizit', unit: 'kcal', agg: 'sum' },
  ],
  trading: [
    { id: 'pnl', label: 'Gewinn/Verlust', unit: '€', agg: 'sum' },
    { id: 'trades', label: 'Trades', unit: '×', agg: 'sum' },
  ],
  gratitude: [
    { id: 'entries', label: 'Dankbarkeits-Einträge', unit: '×', agg: 'sum' },
    { id: 'items', label: 'Dankbarkeiten', unit: '×', agg: 'sum' },
  ],
  cold: [
    { id: 'sessions', label: 'Kalte Duschen', unit: '×', agg: 'sum' },
    { id: 'minutes', label: 'Minuten kalt', unit: 'Min', agg: 'sum' },
  ],
  sleep: [
    { id: 'wakeOk', label: 'Pünktlich aufgestanden', unit: 'Tage', agg: 'sum' },
    { id: 'bedOk', label: 'Pünktlich im Bett', unit: 'Tage', agg: 'sum' },
    { id: 'hours', label: 'Ø Schlafdauer', unit: 'h', agg: 'avg' },
  ],
}

export const PERIODS: {
  id: Period
  label: string
  per: string
  plural: string
  singular: string
}[] = [
  { id: 'day', label: 'Tag', per: 'pro Tag', plural: 'Tage', singular: 'Tag' },
  { id: 'week', label: 'Woche', per: 'pro Woche', plural: 'Wochen', singular: 'Woche' },
  { id: 'month', label: 'Monat', per: 'pro Monat', plural: 'Monate', singular: 'Monat' },
  { id: 'year', label: 'Jahr', per: 'pro Jahr', plural: 'Jahre', singular: 'Jahr' },
]

export function metricDef(goal: Goal) {
  return METRICS[goal.topic].find((m) => m.id === goal.metric) ?? METRICS[goal.topic][0]
}

export function goalUnit(goal: Goal) {
  return goal.dayMin ? 'Tage' : metricDef(goal).unit
}

export function goalTitle(goal: Goal, habits: Habit[]) {
  const per = PERIODS.find((p) => p.id === goal.period)?.per ?? ''
  const m = metricDef(goal)
  const min = goal.dayMin ? `≥ ${fmtNum(goal.dayMin)} ${m.unit}`.trim() : ''
  if (goal.topic === 'habits') {
    const h = habits.find((x) => x.id === goal.refId)
    const name = h ? `${h.icon} ${h.name}` : 'Gelöschte Gewohnheit'
    return goal.dayMin ? `${name}: Tage mit ${min} ${per}` : `${name} ${per}`
  }
  return goal.dayMin ? `Tage mit ${m.label} ${min} ${per}` : `${m.label} ${per}`
}

type Daily = Map<string, { sum: number; n: number }>

function add(m: Daily, day: string, v: number) {
  const e = m.get(day) ?? { sum: 0, n: 0 }
  e.sum += v
  e.n += 1
  m.set(day, e)
}

function buildDaily(goal: Goal, d: AppData): Daily {
  const out: Daily = new Map()
  const day = (iso: string) => dayKey(new Date(iso))
  switch (goal.topic) {
    case 'meditation':
      for (const s of d.meditation) {
        add(out, day(s.startedAt), goal.metric === 'minutes' ? s.actualSec / 60 : 1)
      }
      break
    case 'reading':
      if (goal.metric === 'books') {
        for (const b of d.books) if (b.finishedAt) add(out, day(b.finishedAt), 1)
      } else {
        for (const l of d.readingLogs) add(out, l.day, goal.metric === 'minutes' ? l.minutes : l.pages)
      }
      break
    case 'habits': {
      const h = d.habits.find((x) => x.id === goal.refId)
      if (h) {
        for (const l of d.habitLogs) {
          if (l.habitId === h.id) add(out, l.day, h.kind === 'check' ? (l.count >= 1 ? 1 : 0) : l.count)
        }
      }
      break
    }
    case 'mood': {
      for (const e of d.moods) {
        const k = day(e.at)
        if (goal.metric === 'checkins') add(out, k, 1)
        else add(out, k, goal.metric === 'avgMood' ? mood10(e) : energy10(e))
      }
      break
    }
    case 'focus':
      for (const s of d.focus) add(out, day(s.startedAt), goal.metric === 'minutes' ? s.actualSec / 60 : 1)
      break
    case 'social':
      for (const e of d.social) if (e.kind === goal.metric) add(out, day(e.at), 1)
      break
    case 'diet': {
      const byDay = new Map<string, { eaten: number; burned: number }>()
      for (const e of d.diet) {
        const v = byDay.get(day(e.at)) ?? { eaten: 0, burned: 0 }
        if (e.kind === 'food') v.eaten += e.kcal
        else v.burned += e.kcal
        byDay.set(day(e.at), v)
      }
      for (const [k, v] of byDay) {
        if (goal.metric === 'burned') {
          if (v.burned > 0) add(out, k, v.burned)
        } else if (v.eaten > 0) {
          // Defizit nur für Tage, an denen Essen eingetragen wurde
          add(out, k, d.dietTdee + v.burned - v.eaten)
        }
      }
      break
    }
    case 'trading':
      for (const t of d.trades) add(out, day(t.at), goal.metric === 'pnl' ? t.amount : 1)
      break
    case 'cold':
      for (const c of d.cold) add(out, day(c.startedAt), goal.metric === 'minutes' ? c.actualSec / 60 : 1)
      break
    case 'gratitude':
      for (const g of d.gratitude) add(out, day(g.at), goal.metric === 'items' ? g.items.length : 1)
      break
    case 'sleep':
      for (const e of d.sleep) {
        if (goal.metric === 'wakeOk') {
          const diff = wakeDiff(e, d.sleepCfg)
          if (diff !== null) add(out, e.day, diff <= 0 ? 1 : 0)
        } else if (goal.metric === 'bedOk') {
          const diff = bedDiff(e, d.sleepCfg)
          if (diff !== null) add(out, e.day, diff <= 0 ? 1 : 0)
        } else {
          const dur = durationMin(e)
          if (dur !== null) add(out, e.day, dur / 60)
        }
      }
      break
  }
  return out
}

function isoWeek(d: Date) {
  const t = new Date(d)
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
  const first = new Date(t.getFullYear(), 0, 4)
  return 1 + Math.round(((t.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getDay() + 6) % 7)) / 7)
}

export function periodRange(period: Period, offset = 0) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  const m = today.getMonth()
  let start: Date
  let end: Date
  let label: string
  if (period === 'day') {
    start = addDays(today, offset)
    end = start
    label = offset === 0 ? 'Heute' : start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  } else if (period === 'week') {
    start = addDays(weekStart(today), offset * 7)
    end = addDays(start, 6)
    label = `KW ${isoWeek(start)}`
  } else if (period === 'month') {
    start = new Date(y, m + offset, 1)
    end = new Date(y, m + offset + 1, 0)
    label = start.toLocaleDateString('de-DE', { month: 'short' })
  } else {
    start = new Date(y + offset, 0, 1)
    end = new Date(y + offset, 11, 31)
    label = String(y + offset)
  }
  return { start, end, label }
}

export type GoalStatus = 'done' | 'ontrack' | 'behind' | 'open'

export interface GoalEval {
  current: number
  target: number
  pct: number
  status: GoalStatus
  history: { label: string; start: string; value: number; hit: boolean; current: boolean }[]
  streak: number
  rate: number | null
  // Nur bei Wochenzielen mit Tageswert: ein Punkt pro Wochentag (Mo–So)
  weekDays?: { hit: boolean; future: boolean; today: boolean }[]
}

export function evaluateGoal(goal: Goal, data: AppData): GoalEval {
  const def = metricDef(goal)
  const daily = buildDaily(goal, data)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const created = new Date(goal.createdAt)
  created.setHours(0, 0, 0, 0)
  const dayMin = goal.dayMin

  const valueOf = (start: Date, end: Date) => {
    let s = 0
    let n = 0
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const e = daily.get(dayKey(d))
      if (!e) continue
      if (dayMin) {
        if (e.sum >= dayMin) s += 1
      } else {
        s += e.sum
        n += e.n
      }
    }
    return dayMin || def.agg === 'sum' ? s : n ? s / n : 0
  }

  const cur = periodRange(goal.period, 0)
  const current = valueOf(cur.start, today < cur.end ? today : cur.end)

  const history: GoalEval['history'] = []
  // 12 Zeiträume zurück, damit auch ältere verfehlte Zeiträume für Strafen sichtbar bleiben
  for (let off = 0; off >= -11; off--) {
    const r = periodRange(goal.period, off)
    if (r.end < created) break
    const value = valueOf(r.start, r.end < today ? r.end : today)
    history.unshift({
      label: r.label,
      start: dayKey(r.start),
      value,
      hit: value >= goal.target,
      current: off === 0,
    })
  }

  const closed = history.filter((h) => !h.current)
  let streak = 0
  for (let i = closed.length - 1; i >= 0 && closed[i].hit; i--) streak++
  if (current >= goal.target) streak++
  const rate = closed.length ? closed.filter((h) => h.hit).length / closed.length : null

  let status: GoalStatus
  if (current >= goal.target) status = 'done'
  else if (goal.period === 'day' || def.agg === 'avg') status = current > 0 ? 'behind' : 'open'
  else {
    const days = Math.round((cur.end.getTime() - cur.start.getTime()) / 86_400_000) + 1
    const elapsed = Math.round((today.getTime() - cur.start.getTime()) / 86_400_000) + 1
    status = current >= goal.target * (elapsed / days) * 0.85 ? 'ontrack' : 'behind'
  }

  const weekDays =
    dayMin && goal.period === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDays(cur.start, i)
          return {
            hit: (daily.get(dayKey(d))?.sum ?? 0) >= dayMin,
            future: d > today,
            today: d.getTime() === today.getTime(),
          }
        })
      : undefined

  return {
    current,
    target: goal.target,
    pct: goal.target > 0 ? Math.max(0, Math.min(1, current / goal.target)) : 0,
    status,
    history,
    streak,
    rate,
    weekDays,
  }
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  done: 'Erreicht ✓',
  ontrack: 'Im Plan',
  behind: 'Hinterher',
  open: 'Offen',
}

export function fmtNum(v: number) {
  return Number.isInteger(v) ? String(v) : (Math.round(v * 10) / 10).toString()
}

export function periodStartKey(period: Period, offset = 0) {
  return dayKey(periodRange(period, offset).start)
}

export const PERIOD_NAMES: Record<TodoPeriod, { now: string; next: string; short: string }> = {
  day: { now: 'Heute', next: 'Morgen', short: 'Tag' },
  week: { now: 'Diese Woche', next: 'Nächste Woche', short: 'Woche' },
  month: { now: 'Dieser Monat', next: 'Nächster Monat', short: 'Monat' },
  year: { now: 'Dieses Jahr', next: 'Nächstes Jahr', short: 'Jahr' },
  deadline: { now: 'Deadlines', next: 'Deadlines', short: 'Deadline' },
}

export interface DuePenalty {
  id: string
  goal: Goal
  start: string
  label: string
  value: number
}

// Verfehlte, abgelaufene Zeiträume von Zielen mit Strafe, deren Strafe noch nicht erledigt ist.
// Der Zeitraum, in dem das Ziel angelegt wurde, zählt nicht (er war nur teilweise im Spiel).
export function duePenalties(goals: Goal[], data: AppData, logs: PenaltyLog[]): DuePenalty[] {
  const done = new Set(logs.map((l) => l.id))
  const out: DuePenalty[] = []
  for (const g of goals) {
    if (!g.penalty) continue
    const createdDay = dayKey(new Date(g.createdAt))
    for (const h of evaluateGoal(g, data).history) {
      if (h.current || h.hit || h.start < createdDay) continue
      const id = `${g.id}:${h.start}`
      if (!done.has(id)) out.push({ id, goal: g, start: h.start, label: h.label, value: h.value })
    }
  }
  return out.sort((a, b) => b.start.localeCompare(a.start))
}

// Zusatzzeile unter dem Zeitraum, z. B. "KW 44 · 26.10.–01.11."
export function periodSubtitle(period: TodoPeriod, data?: AppData) {
  if (period === 'deadline') {
    const next = (data?.todos ?? [])
      .filter((t) => t.period === 'deadline' && !t.done)
      .map((t) => t.start)
      .sort()[0]
    return next
      ? `Nächste Frist: ${new Date(`${next}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
      : 'Eigene Fristen mit Datum'
  }
  const r = periodRange(period, 0)
  const d = (x: Date) => x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  if (period === 'day') {
    return r.start.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  if (period === 'week') return `${r.label} · ${d(r.start)}–${d(r.end)}`
  if (period === 'month') {
    return r.start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }
  return r.label
}
