import { useEffect, useRef, useState } from 'react'
import { unlockAudio } from './audio'
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  loadSnapshot,
  pinnedPhotoIds,
} from './backups'
import type { SnapshotMeta, SnapshotReason } from './backups'
import { periodStartKey } from './goals'
import type { AppData } from './goals'
import { usePhotoApi } from './photos'
import Diet from './screens/Diet'
import Focus, { hasPomoRunning } from './screens/Focus'
import Habits from './screens/Habits'
import Home from './screens/Home'
import Meditation from './screens/Meditation'
import Mood from './screens/Mood'
import Reading from './screens/Reading'
import Social from './screens/Social'
import Todo from './screens/Todo'
import Trading from './screens/Trading'
import {
  exportBackup,
  lastExportAt,
  loadActive,
  parseBackup,
  requestPersistentStorage,
  useCollection,
} from './storage'
import type { Row, StoreName } from './storage'
import type {
  Book,
  DietEntry,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  MeditationSession,
  MoodEntry,
  Period,
  ReadingLog,
  Route,
  SocialEntry,
  TodoItem,
  Topic,
  TradeEntry,
} from './types'

const TDEE_KEY = 'progress:diet-tdee'

const byStart = (a: { startedAt: string }, b: { startedAt: string }) =>
  a.startedAt.localeCompare(b.startedAt)
const byAt = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at)

// Eine laufende Sitzung wird nach einem Neuladen der App fortgesetzt
function initialRoute(): Route {
  if (loadActive()) return 'meditation'
  if (hasPomoRunning()) return 'focus'
  return 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(initialRoute)

  const meditation = useCollection<MeditationSession>('meditation', byStart)
  const books = useCollection<Book>('books')
  const readingLogs = useCollection<ReadingLog>('readingLogs')
  const habits = useCollection<Habit>('habits')
  const habitLogs = useCollection<HabitLog>('habitLogs')
  const moods = useCollection<MoodEntry>('moods', byAt)
  const focus = useCollection<FocusSession>('focus', byStart)
  const social = useCollection<SocialEntry>('social', byAt)
  const todos = useCollection<TodoItem>('todos')
  const diet = useCollection<DietEntry>('diet', byAt)
  const trades = useCollection<TradeEntry>('trades', byAt)
  const goals = useCollection<Goal>('goals')
  const photoApi = usePhotoApi()
  const [dietTdee, setDietTdee] = useState(() => {
    const n = parseInt(localStorage.getItem(TDEE_KEY) ?? '', 10)
    return n >= 800 ? n : 2400
  })
  const changeTdee = (n: number) => {
    localStorage.setItem(TDEE_KEY, String(n))
    setDietTdee(n)
  }

  const stores: Record<
    StoreName,
    { items: Row[]; merge(list: Row[]): number; replaceAll(list: Row[]): void }
  > = {
    meditation,
    books,
    readingLogs,
    habits,
    habitLogs,
    moods,
    focus,
    social,
    todos,
    diet,
    trades,
    goals,
  }
  const collect = () =>
    Object.fromEntries(
      (Object.keys(stores) as StoreName[]).map((k) => [k, stores[k].items]),
    ) as Record<StoreName, Row[]>

  // Sicherungen (Schnappschüsse) und Datei-Export
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([])
  const [snapsLoaded, setSnapsLoaded] = useState(false)
  const [lastExport, setLastExport] = useState(lastExportAt)

  const snapshotNow = async (reason: SnapshotReason) => {
    setSnaps(await createSnapshot(collect(), photoApi.metas, dietTdee, reason))
  }

  useEffect(() => {
    void listSnapshots().then((l) => {
      setSnaps(l)
      setSnapsLoaded(true)
    })
  }, [])

  useEffect(requestPersistentStorage, [])

  const allLoaded =
    meditation.loaded &&
    books.loaded &&
    readingLogs.loaded &&
    habits.loaded &&
    habitLogs.loaded &&
    moods.loaded &&
    focus.loaded &&
    social.loaded &&
    todos.loaded &&
    diet.loaded &&
    trades.loaded &&
    goals.loaded &&
    photoApi.loaded &&
    snapsLoaded

  // Fotos, die eine Sicherung braucht, werden nicht gelöscht
  useEffect(() => {
    photoApi.setPinned(pinnedPhotoIds(snaps))
    if (allLoaded) void photoApi.gc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snaps, allLoaded])

  // Automatische Sicherung: einmal pro Tag beim Start, sobald es Daten gibt
  useEffect(() => {
    if (!allLoaded) return
    const total = Object.values(collect()).reduce((a, l) => a + l.length, 0)
    const last = snaps.find((s) => s.reason === 'auto')
    if (total === 0 || (last && Date.now() - Date.parse(last.at) < 20 * 3_600_000)) return
    void snapshotNow('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded])

  const restoreSnapshot = async (id: string) => {
    const s = await loadSnapshot(id)
    if (!s) return
    await snapshotNow('before-restore')
    for (const k of Object.keys(stores) as StoreName[]) stores[k].replaceAll(s.data[k] ?? [])
    photoApi.restoreIndex(s.photos)
    changeTdee(s.dietTdee)
  }

  // Fotos, deren Eintrag gelöscht wurde (oder nie gespeichert), werden aufgeräumt
  const owners = [
    meditation.items,
    books.items,
    readingLogs.items,
    moods.items,
    focus.items,
    social.items,
    todos.items,
    diet.items,
    trades.items,
  ].flatMap((l) => l.map((x) => x.id))
  const ownersRef = useRef(owners)
  ownersRef.current = owners
  useEffect(() => {
    if (!allLoaded || route !== 'home') return
    const t = setTimeout(() => photoApi.cleanup(new Set(ownersRef.current)), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded, route])

  // Der erste Tipp schaltet den Ton frei (iOS verlangt eine Nutzergeste)
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const data: AppData = {
    meditation: meditation.items,
    books: books.items,
    readingLogs: readingLogs.items,
    habits: habits.items,
    habitLogs: habitLogs.items,
    moods: moods.items,
    focus: focus.items,
    social: social.items,
    todos: todos.items,
    diet: diet.items,
    trades: trades.items,
    dietTdee,
  }

  const toggleTodo = (id: string) => {
    const t = todos.items.find((x) => x.id === id)
    if (!t) return
    todos.upsert(
      t.done
        ? { ...t, done: false, doneAt: undefined }
        : { ...t, done: true, doneAt: new Date().toISOString() },
    )
  }

  // Zähl-ToDo: erledigt, sobald count das target erreicht
  const bumpTodo = (id: string, delta: 1 | -1) => {
    const t = todos.items.find((x) => x.id === id)
    if (!t || !t.target) return
    const count = Math.max(0, Math.min(t.target, (t.count ?? 0) + delta))
    const done = count >= t.target
    todos.upsert({
      ...t,
      count,
      done,
      doneAt: done ? (t.doneAt ?? new Date().toISOString()) : undefined,
    })
  }

  const addTodo = (title: string, period: Period, offset: 0 | 1, target?: number) =>
    todos.upsert({
      id: crypto.randomUUID(),
      title,
      period,
      start: periodStartKey(period, offset),
      done: false,
      target,
      count: target ? 0 : undefined,
      createdAt: new Date().toISOString(),
    })

  const carryTodo = (id: string) => {
    const t = todos.items.find((x) => x.id === id)
    if (t) todos.upsert({ ...t, start: periodStartKey(t.period) })
  }

  const goalProps = (topic: Topic) => ({
    data,
    goals: goals.items.filter((g) => g.topic === topic),
    onUpsertGoal: goals.upsert,
    onRemoveGoal: goals.remove,
    onBack: () => setRoute('home'),
  })

  switch (route) {
    case 'diet':
      return (
        <Diet
          {...goalProps('diet')}
          onTdee={changeTdee}
          onSave={diet.upsert}
          onDelete={diet.remove}
        />
      )
    case 'trading':
      return <Trading {...goalProps('trading')} onSave={trades.upsert} onDelete={trades.remove} />
    case 'todo':
      return (
        <Todo
          data={data}
          goals={goals.items}
          onToggle={toggleTodo}
          onBump={bumpTodo}
          onAdd={addTodo}
          onDelete={todos.remove}
          onCarry={carryTodo}
          onOpenTopic={setRoute}
          onBack={() => setRoute('home')}
        />
      )
    case 'meditation':
      return <Meditation {...goalProps('meditation')} onSave={meditation.upsert} onDelete={meditation.remove} />
    case 'reading':
      return (
        <Reading
          {...goalProps('reading')}
          onUpsertBook={books.upsert}
          onRemoveBook={(id) => {
            books.remove(id)
            readingLogs.removeWhere((l) => l.bookId === id)
          }}
          onUpsertLog={readingLogs.upsert}
          onRemoveLog={readingLogs.remove}
        />
      )
    case 'habits':
      return (
        <Habits
          {...goalProps('habits')}
          onUpsertHabit={habits.upsert}
          onRemoveHabit={(id) => {
            habits.remove(id)
            habitLogs.removeWhere((l) => l.habitId === id)
            goals.removeWhere((g) => g.refId === id)
          }}
          onUpsertLog={habitLogs.upsert}
          onRemoveLog={habitLogs.remove}
        />
      )
    case 'mood':
      return <Mood {...goalProps('mood')} onSave={moods.upsert} onDelete={moods.remove} />
    case 'focus':
      return <Focus {...goalProps('focus')} onSave={focus.upsert} onDelete={focus.remove} />
    case 'social':
      return <Social {...goalProps('social')} onSave={social.upsert} onDelete={social.remove} />
  }

  return (
    <Home
      data={data}
      goals={goals.items}
      onOpen={setRoute}
      onToggleTodo={toggleTodo}
      onBumpTodo={bumpTodo}
      onAddTodo={addTodo}
      onExport={async (withPhotos) => {
        const photos = withPhotos ? await photoApi.dumpAll() : []
        if (await exportBackup(collect(), photos)) setLastExport(Date.now())
      }}
      onImport={async (file) => {
        try {
          const { stores: parsed, photos } = await parseBackup(file)
          await snapshotNow('before-import')
          let added = 0
          for (const k of Object.keys(parsed) as StoreName[]) {
            added += stores[k].merge(parsed[k] ?? [])
          }
          const p = await photoApi.importAll(photos)
          return `${added} Einträge${p ? ` und ${p} Fotos` : ''} importiert`
        } catch {
          return 'Datei konnte nicht gelesen werden'
        }
      }}
      snapshots={snaps}
      lastExport={lastExport}
      photoCount={photoApi.metas.length}
      onSnapshotNow={() => snapshotNow('manual')}
      onRestore={restoreSnapshot}
      onDeleteSnapshot={async (id) => setSnaps(await deleteSnapshot(id))}
    />
  )
}
