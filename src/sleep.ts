import { addDays, dayKey } from './stats'
import type { SleepCfg, SleepEntry } from './types'

export const DEFAULT_SLEEP_CFG: SleepCfg = { wake: '06:30', bed: '22:30' }

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const minOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export const hhmmOf = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Zeiten nach Mitternacht liegen "hinter" dem Abend (00:30 ist später als 23:00)
const normBed = (min: number) => (min < 12 * 60 ? min + 24 * 60 : min)

// Minuten gegenüber dem Ziel; positiv = später als geplant
export function wakeDiff(e: SleepEntry, cfg: SleepCfg) {
  return e.wake ? minOfDay(e.wake) - toMin(cfg.wake) : null
}

export function bedDiff(e: SleepEntry, cfg: SleepCfg) {
  return e.bed ? normBed(minOfDay(e.bed)) - normBed(toMin(cfg.bed)) : null
}

export function durationMin(e: SleepEntry) {
  if (!e.bed || !e.wake) return null
  const d = (Date.parse(e.wake) - Date.parse(e.bed)) / 60_000
  return d > 0 && d < 20 * 60 ? d : null
}

// Geplante Schlafdauer zwischen Zubettgeh- und Aufstehziel
export function sleepGoalMin(cfg: SleepCfg) {
  return (toMin(cfg.wake) + 1440 - toMin(cfg.bed)) % 1440
}

export const fmtDur = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`

export const fmtDiff = (min: number) =>
  min === 0 ? 'pünktlich' : `${min > 0 ? '+' : '−'}${Math.abs(Math.round(min))} min`

// Zeitpunkt für day + hh:mm. Eine Zubettgehzeit am Abend gehört zur Vornacht
export function isoFor(day: string, hhmm: string, kind: 'wake' | 'bed') {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(`${day}T12:00:00`)
  if (kind === 'bed' && (h || 0) >= 14) d.setDate(d.getDate() - 1)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toISOString()
}

// Tag des Aufstehens, zu dem ein "Jetzt ins Bett" gehört
export function entryDayForBedNow(now = new Date()) {
  return dayKey(now.getHours() >= 14 ? addDays(now, 1) : now)
}
