export interface MeditationSession {
  id: string
  startedAt: string
  plannedMin: number
  actualSec: number
  type: string
  interruptions: number
  completed: boolean
}

export interface ActiveSession {
  startedAt: number
  plannedMin: number
  type: string
  interruptions: number
}

export interface FinishedSession {
  startedAt: number
  plannedMin: number
  type: string
  interruptions: number
  actualSec: number
  completed: boolean
}

export const MEDITATION_TYPES = [
  { id: 'atem-fokus', label: 'Atem-Fokus' },
  { id: 'body-scan', label: 'Body Scan' },
  { id: 'metta', label: 'Liebende Güte (Metta)' },
  { id: 'offenes-gewahrsein', label: 'Offenes Gewahrsein' },
  { id: 'mantra', label: 'Mantra' },
  { id: 'gehen', label: 'Gehmeditation' },
] as const

export const DEFAULT_TYPE = 'atem-fokus'
export const DEFAULT_MINUTES = 15
export const MINUTE_OPTIONS = [5, 10, 12, 15, 20, 25, 30]

export function typeLabel(id: string) {
  return MEDITATION_TYPES.find((t) => t.id === id)?.label ?? id
}

export interface Book {
  id: string
  title: string
  author?: string
  totalPages?: number
  startedAt: string
  finishedAt?: string
}

export interface ReadingLog {
  id: string
  bookId: string
  day: string
  minutes: number
  pages: number
}

// check: Ja/Nein pro Tag, target = Tage pro Woche. count: Zähler pro Tag, target = Tagesziel
export type HabitKind = 'check' | 'count'

export interface Habit {
  id: string
  name: string
  icon: string
  kind: HabitKind
  target: number
  createdAt: string
}

export interface HabitLog {
  id: string
  habitId: string
  day: string
  count: number
}

export interface MoodEntry {
  id: string
  at: string
  // Stimmung 1–5
  mood: number
  // Energie: neue Einträge 1–10 (energyScale 10), ältere Einträge 1–5
  energy: number
  energyScale?: 10
  note?: string
}

export interface FocusSession {
  id: string
  startedAt: string
  plannedMin: number
  actualSec: number
  task: string
  distractions: number
  completed: boolean
}

export type Topic =
  | 'meditation'
  | 'reading'
  | 'habits'
  | 'mood'
  | 'focus'
  | 'social'
  | 'diet'
  | 'trading'
  | 'gratitude'
  | 'sleep'

export interface GratitudeEntry {
  id: string
  at: string
  items: string[]
}

// Eine Nacht, zugeordnet dem Tag des Aufstehens (day). bed und wake sind ISO-Zeitpunkte
export interface SleepEntry {
  id: string
  day: string
  bed?: string
  wake?: string
  quality?: number
  note?: string
}

export interface SleepCfg {
  wake: string
  bed: string
}

export interface Settings {
  dietTdee: number
  sleepCfg: SleepCfg
}

export interface DietEntry {
  id: string
  at: string
  kind: 'food' | 'activity'
  // Mahlzeit bei Essen, Aktivität (Joggen, Kraftsport, …) bei Aktivität
  label: string
  kcal: number
  note?: string
}

export const DIET_ACTIVITIES = ['Joggen', 'Kraftsport', 'Radfahren', 'Schwimmen', 'Gehen', 'HIIT', 'Sonstiges']

export interface TradeEntry {
  id: string
  at: string
  // Gewinn positiv, Verlust negativ (in €)
  amount: number
  label?: string
  note?: string
}
export type SocialKind = 'indirect' | 'approach' | 'contact' | 'date'

export interface SocialEntry {
  id: string
  at: string
  kind: SocialKind
  note?: string
  rating?: number
}

export const SOCIAL_KINDS: { id: SocialKind; label: string; short: string }[] = [
  { id: 'indirect', label: 'Indirekte Interaktion', short: 'Indirekt' },
  { id: 'approach', label: 'Angesprochen', short: 'Angesprochen' },
  { id: 'contact', label: 'Kontakt ausgetauscht', short: 'Kontakt' },
  { id: 'date', label: 'Date', short: 'Date' },
]

export type Period = 'day' | 'week' | 'month' | 'year'
export type Route = 'home' | 'todo' | 'notes' | Topic

export interface Goal {
  id: string
  topic: Topic
  metric: string
  period: Period
  target: number
  refId?: string
  // Gesetzt: gezählt werden Tage, an denen der Tageswert mindestens dayMin erreicht
  dayMin?: number
  // Optional: Strafe, wenn das Ziel in einem abgelaufenen Zeitraum verfehlt wurde
  penalty?: { text: string; amount?: number }
  createdAt: string
}

// Erledigte Strafe für einen verfehlten Zeitraum (id = `${goalId}:${start}`)
export interface PenaltyLog {
  id: string
  goalId: string
  start: string
  doneAt: string
}

export type TodoPeriod = Period | 'deadline'

// Ein Strich der Zeichenfläche. Koordinaten in 1000er-Breite, pts = x, y, Druck im Dreierpack
export interface Stroke {
  tool: 'pen' | 'marker'
  color: string
  width: number
  pts: number[]
}

export type NoteBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'ink'; h: number; strokes: Stroke[] }
  | { id: string; type: 'image'; photoId: string }

export interface NoteEntry {
  id: string
  at: string
  updatedAt: string
  title: string
  blocks: NoteBlock[]
}

export interface TodoItem {
  id: string
  title: string
  period: TodoPeriod
  // erster Tag des Zeitraums (Tag, Montag, Monatserster, 1. Januar); bei Deadlines das Fälligkeitsdatum
  start: string
  done: boolean
  doneAt?: string
  // Zähl-ToDo: erst wenn count das target erreicht, gilt es als erledigt. Ohne target: normales Abhaken
  target?: number
  count?: number
  createdAt: string
}
