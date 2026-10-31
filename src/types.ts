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
