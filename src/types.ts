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
  mood: number
  energy: number
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

export type Topic = 'meditation' | 'reading' | 'habits' | 'mood' | 'focus' | 'social'
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
export type Route = 'home' | 'todo' | Topic

export interface Goal {
  id: string
  topic: Topic
  metric: string
  period: Period
  target: number
  refId?: string
  // Gesetzt: gezählt werden Tage, an denen der Tageswert mindestens dayMin erreicht
  dayMin?: number
  createdAt: string
}

export interface TodoItem {
  id: string
  title: string
  period: Period
  // erster Tag des Zeitraums (Tag, Montag, Monatserster, 1. Januar)
  start: string
  done: boolean
  doneAt?: string
  createdAt: string
}
