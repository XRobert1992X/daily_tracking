import { addDays, dayKey, weekStart } from './stats'
import type {
  Book,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  MeditationSession,
  MoodEntry,
  Period,
  ReadingLog,
  SocialEntry,
  Topic,
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

export function goalTitle(goal: Goal, habits: Habit[]) {
  const per = PERIODS.find((p) => p.id === goal.period)?.per ?? ''
  const m = metricDef(goal)
  if (goal.topic === 'habits') {
    const h = habits.find((x) => x.id === goal.refId)
    return `${h ? `${h.icon} ${h.name}` : 'Gelöschte Gewohnheit'} ${per}`
  }
  return `${m.label} ${per}`
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
        else add(out, k, goal.metric === 'avgMood' ? e.mood : e.energy)
      }
      break
    }
    case 'focus':
      for (const s of d.focus) add(out, day(s.startedAt), goal.metric === 'minutes' ? s.actualSec / 60 : 1)
      break
    case 'social':
      for (const e of d.social) if (e.kind === goal.metric) add(out, day(e.at), 1)
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
  history: { label: string; value: number; hit: boolean; current: boolean }[]
  streak: number
  rate: number | null
}

export function evaluateGoal(goal: Goal, data: AppData): GoalEval {
  const def = metricDef(goal)
  const daily = buildDaily(goal, data)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const created = new Date(goal.createdAt)
  created.setHours(0, 0, 0, 0)

  const valueOf = (start: Date, end: Date) => {
    let s = 0
    let n = 0
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const e = daily.get(dayKey(d))
      if (e) {
        s += e.sum
        n += e.n
      }
    }
    return def.agg === 'sum' ? s : n ? s / n : 0
  }

  const cur = periodRange(goal.period, 0)
  const current = valueOf(cur.start, today < cur.end ? today : cur.end)

  const history: GoalEval['history'] = []
  for (let off = 0; off >= -7; off--) {
    const r = periodRange(goal.period, off)
    if (r.end < created) break
    const value = valueOf(r.start, r.end < today ? r.end : today)
    history.unshift({ label: r.label, value, hit: value >= goal.target, current: off === 0 })
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

  return {
    current,
    target: goal.target,
    pct: goal.target > 0 ? Math.min(1, current / goal.target) : 0,
    status,
    history,
    streak,
    rate,
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
