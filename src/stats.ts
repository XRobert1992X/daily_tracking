import type { MeditationSession } from './types'

export const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')

export function streak(sessions: MeditationSession[]) {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))))
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// Unterbrechungen pro 10 Minuten, damit unterschiedlich lange Sitzungen vergleichbar sind
export function ratePer10(s: MeditationSession) {
  return s.actualSec >= 60 ? s.interruptions / (s.actualSec / 600) : null
}

export function avgRate(list: MeditationSession[]) {
  const rates = list.map(ratePer10).filter((r): r is number => r !== null)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
}

export function trend(sessions: MeditationSession[]) {
  const recent = sessions.slice(-5)
  const previous = sessions.slice(-10, -5)
  return { recent: avgRate(recent), previous: avgRate(previous) }
}

export function totalMinutes(sessions: MeditationSession[]) {
  return Math.round(sessions.reduce((a, s) => a + s.actualSec, 0) / 60)
}

export function fmtClock(totalSec: number) {
  const s = Math.max(0, Math.ceil(totalSec))
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}
