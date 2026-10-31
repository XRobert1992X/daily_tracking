import { useEffect, useState } from 'react'
import BackupPanel from '../components/BackupPanel'
import { TopicIcon } from '../components/icons'
import PeriodBoard from '../components/PeriodBoard'
import { Seg } from '../components/ui'
import { PERIOD_NAMES, duePenalties, periodStartKey } from '../goals'
import type { AppData } from '../goals'
import { dayStreak, dayKey, energy10, sum, todayKey, weekKeys } from '../stats'
import { durationMin, fmtDiff, fmtDur, fmtTime, wakeDiff } from '../sleep'
import type { SnapshotMeta } from '../backups'
import { PenaltyList } from '../components/PenaltyList'
import type { Goal, Route, TodoPeriod } from '../types'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

interface Props {
  data: AppData
  goals: Goal[]
  onOpen: (t: Route) => void
  onToggleTodo: (id: string) => void
  onBumpTodo: (id: string, delta: 1 | -1) => void
  onAddTodo: (title: string, period: TodoPeriod, offset: 0 | 1, target?: number, due?: string) => void
  onExport: (withPhotos: boolean) => Promise<void>
  onImport: (file: File) => Promise<string>
  snapshots: SnapshotMeta[]
  lastExport: number | null
  photoCount: number
  onSnapshotNow: () => Promise<void>
  onRestore: (id: string) => Promise<void>
  onDeleteSnapshot: (id: string) => Promise<void>
}

export default function Home({
  data,
  goals,
  onOpen,
  onToggleTodo,
  onBumpTodo,
  onAddTodo,
  onExport,
  onImport,
  snapshots,
  lastExport,
  photoCount,
  onSnapshotNow,
  onRestore,
  onDeleteSnapshot,
}: Props) {
  const online = useOnline()
  const [period, setPeriod] = useState<TodoPeriod>('day')
  const dues = duePenalties(goals, data, data.penalties)
  const dueTotal = dues.reduce((a, p) => a + (p.goal.penalty?.amount ?? 0), 0)
  const today = todayKey()
  const week = new Set(weekKeys())
  const dayOf = (iso: string) => dayKey(new Date(iso))
  const dayStart = periodStartKey('day')
  const todosOpenToday = data.todos.filter(
    (t) =>
      !t.done &&
      ((t.period === 'day' && t.start <= dayStart) || (t.period === 'deadline' && t.start <= dayStart)),
  ).length

  const medWeek = data.meditation.filter((s) => week.has(dayOf(s.startedAt))).length
  const medStreak = dayStreak(new Set(data.meditation.map((s) => dayOf(s.startedAt))))
  const readToday = sum(data.readingLogs.filter((l) => l.day === today).map((l) => l.minutes))
  const habitsToday = data.habitLogs.filter((l) => l.day === today && l.count > 0).length
  const lastMood = data.moods[data.moods.length - 1]
  const focusToday = data.focus.filter((s) => dayOf(s.startedAt) === today)
  const socialWeek = data.social.filter((e) => week.has(dayOf(e.at)))
  const approachWeek = socialWeek.filter((e) => e.kind === 'approach').length
  const datesWeek = socialWeek.filter((e) => e.kind === 'date').length

  const dietToday = data.diet.filter((e) => dayOf(e.at) === today)
  const eatenToday = sum(dietToday.filter((e) => e.kind === 'food').map((e) => e.kcal))
  const burnedToday = sum(dietToday.filter((e) => e.kind === 'activity').map((e) => e.kcal))
  const balanceToday = data.dietTdee + burnedToday - eatenToday
  const kcal = (n: number) => Math.round(Math.abs(n)).toLocaleString('de-DE')
  const dietInfo = !data.diet.length
    ? 'Noch kein Eintrag'
    : eatenToday > 0
      ? `Heute ${balanceToday >= 0 ? 'Defizit' : 'Überschuss'} ${kcal(balanceToday)} kcal`
      : `Heute ${kcal(burnedToday)} kcal verbrannt`
  const eur = (n: number) =>
    `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`
  const tradeToday = sum(data.trades.filter((e) => dayOf(e.at) === today).map((e) => e.amount))
  const tradeMonth = sum(
    data.trades.filter((e) => dayOf(e.at).startsWith(today.slice(0, 7))).map((e) => e.amount),
  )
  const tradeInfo = data.trades.length
    ? `Heute ${eur(tradeToday)} · Monat ${eur(tradeMonth)}`
    : 'Noch kein Trade'

  const gratitudeToday = data.gratitude.filter((g) => dayOf(g.at) === today).length
  const gratitudeStreak = dayStreak(new Set(data.gratitude.map((g) => dayOf(g.at))))
  const gratitudeInfo = data.gratitude.length
    ? `Heute ${gratitudeToday}× · Serie ${gratitudeStreak} Tage`
    : 'Noch kein Eintrag'
  const sleepToday = data.sleep.find((e) => e.day === today)
  const lastSleep = [...data.sleep].reverse().find((e) => durationMin(e) !== null)
  const sleepInfo = sleepToday?.wake
    ? `Aufgestanden ${fmtTime(sleepToday.wake)} (${fmtDiff(wakeDiff(sleepToday, data.sleepCfg) ?? 0)})`
    : lastSleep
      ? `Letzte Nacht ${fmtDur(durationMin(lastSleep) ?? 0)}`
      : `Ziel: auf ${data.sleepCfg.wake} · Bett ${data.sleepCfg.bed}`

  const topics: { id: Exclude<Route, 'home'>; name: string; info: string }[] = [
    {
      id: 'todo',
      name: 'ToDo',
      info: data.todos.length
        ? `${todosOpenToday} offen heute · ${data.todos.filter((t) => !t.done).length} insgesamt`
        : 'Tag, Woche, Monat, Jahr',
    },
    {
      id: 'notes',
      name: 'Notizen',
      info: data.notes.length
        ? `${data.notes.length} ${data.notes.length === 1 ? 'Seite' : 'Seiten'}`
        : 'Text, Zeichnungen, Screenshots',
    },
    {
      id: 'diet',
      name: 'Diät',
      info: dietInfo,
    },
    {
      id: 'trading',
      name: 'Trading',
      info: tradeInfo,
    },
    {
      id: 'sleep',
      name: 'Aufstehen & Schlaf',
      info: sleepInfo,
    },
    {
      id: 'gratitude',
      name: 'Dankbarkeit',
      info: gratitudeInfo,
    },
    {
      id: 'meditation',
      name: 'Meditation',
      info: data.meditation.length ? `${medWeek}× diese Woche · Serie ${medStreak} Tage` : 'Noch keine Sitzung',
    },
    {
      id: 'reading',
      name: 'Lesen',
      info: data.books.some((b) => !b.finishedAt)
        ? `${readToday} Min heute · ${data.books.filter((b) => !b.finishedAt).length} Buch aktuell`
        : 'Noch kein Buch',
    },
    {
      id: 'habits',
      name: 'Gewohnheiten',
      info: data.habits.length ? `${habitsToday} von ${data.habits.length} heute aktiv` : 'Noch keine Gewohnheit',
    },
    {
      id: 'mood',
      name: 'Stimmung & Energie',
      info: lastMood
        ? `Zuletzt: Stimmung ${lastMood.mood}/5 · Energie ${energy10(lastMood)}/10`
        : 'Noch kein Check-in',
    },
    {
      id: 'focus',
      name: 'Fokus',
      info: focusToday.length
        ? `${focusToday.length} ${focusToday.length === 1 ? 'Block' : 'Blöcke'} · ${Math.round(sum(focusToday.map((s) => s.actualSec)) / 60)} Min heute`
        : 'Pomodoro-Timer',
    },
    {
      id: 'social',
      name: 'Soziale Interaktion',
      info: data.social.length
        ? `${approachWeek}× angesprochen · ${datesWeek} ${datesWeek === 1 ? 'Date' : 'Dates'} diese Woche`
        : 'Noch kein Eintrag',
    },
  ]

  return (
    <main className="app">
      <header className="header">
        <div>
          <p className="muted">
            {new Date().toLocaleDateString('de-DE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1>Progress</h1>
        </div>
        <span className={`pill ${online ? 'on' : 'off'}`}>
          <i /> {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {dues.length > 0 && (
        <section className="card penalty-card">
          <p className="muted">
            Offene Strafen ({dues.length}
            {dueTotal > 0 ? ` · ${dueTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : ''})
          </p>
          <PenaltyList due={dues} data={data} />
        </section>
      )}

      <p className="muted section">Ziele</p>
      <Seg
        value={period}
        onChange={setPeriod}
        options={(['day', 'week', 'month', 'year', 'deadline'] as TodoPeriod[]).map((p) => ({
          id: p,
          label: PERIOD_NAMES[p].short,
        }))}
      />
      <PeriodBoard
        period={period}
        data={data}
        goals={goals}
        onToggle={onToggleTodo}
        onBump={onBumpTodo}
        onAdd={onAddTodo}
        onOpenTopic={onOpen}
      />

      <p className="muted section">Themen</p>
      {topics.map((t) => (
        <button key={t.id} className="topic" onClick={() => onOpen(t.id)}>
          <TopicIcon topic={t.id} />
          <span className="topic-body">
            <b>{t.name}</b>
            <small className="muted">{t.info}</small>
          </span>
          <span className="chev">›</span>
        </button>
      ))}

      <p className="muted section">Backup</p>
      <BackupPanel
        snapshots={snapshots}
        lastExport={lastExport}
        photoCount={photoCount}
        onExport={onExport}
        onImport={onImport}
        onSnapshotNow={onSnapshotNow}
        onRestore={onRestore}
        onDeleteSnapshot={onDeleteSnapshot}
      />
    </main>
  )
}
