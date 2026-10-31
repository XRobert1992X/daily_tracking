import type { Habit, MoodEntry } from './types'

export const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')
export const todayKey = () => dayKey(new Date())

export function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function weekStart(d = new Date()) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function weekKeys(d = new Date()) {
  const m = weekStart(d)
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(m, i)))
}

// letzte n Tage, älteste zuerst
export function lastDays(n: number) {
  const today = new Date()
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - (n - 1))))
}

// alle Tage des aktuellen Monats
export function monthKeys() {
  const now = new Date()
  const n = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1)))
}

export function shortDate(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function fmtClock(totalSec: number) {
  const s = Math.max(0, Math.ceil(totalSec))
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

// Tage mit mindestens einem Eintrag in Folge; heute darf noch fehlen
export function dayStreak(days: Set<string>) {
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
export interface Counted {
  count: number
  sec: number
}

export function rate10(c: Counted) {
  return c.sec >= 60 ? c.count / (c.sec / 600) : null
}

export function avgRate10(list: Counted[]) {
  const rates = list.map(rate10).filter((r): r is number => r !== null)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
}

export function trend10(list: Counted[]) {
  return { recent: avgRate10(list.slice(-5)), previous: avgRate10(list.slice(-10, -5)) }
}

export function habitDayDone(h: Habit, count: number) {
  return h.kind === 'check' ? count >= 1 : count >= h.target
}

export function habitStreak(h: Habit, byDay: Map<string, number>) {
  if (h.kind === 'check' && h.target < 7) {
    const met = (monday: Date) => {
      let c = 0
      for (let i = 0; i < 7; i++) if ((byDay.get(dayKey(addDays(monday, i))) ?? 0) >= 1) c++
      return c >= h.target
    }
    let cur = weekStart()
    if (!met(cur)) cur = addDays(cur, -7)
    let n = 0
    while (met(cur) && n < 520) {
      n++
      cur = addDays(cur, -7)
    }
    return { n, unit: 'Wochen' }
  }
  const done = new Set([...byDay].filter(([, c]) => habitDayDone(h, c)).map(([d]) => d))
  return { n: dayStreak(done), unit: 'Tage' }
}

// Energie immer auf der 10er-Skala; ältere Einträge (1–5) werden verdoppelt
export const energy10 = (e: MoodEntry) => (e.energyScale === 10 ? e.energy : e.energy * 2)

export function dailyMood(entries: MoodEntry[]) {
  const sums = new Map<string, { mood: number; energy: number; n: number }>()
  for (const e of entries) {
    const k = dayKey(new Date(e.at))
    const s = sums.get(k) ?? { mood: 0, energy: 0, n: 0 }
    s.mood += e.mood
    s.energy += energy10(e)
    s.n++
    sums.set(k, s)
  }
  return new Map(
    [...sums].map(([k, s]) => [k, { mood: s.mood / s.n, energy: s.energy / s.n }]),
  )
}

export function sum(list: number[]) {
  return list.reduce((a, b) => a + b, 0)
}
