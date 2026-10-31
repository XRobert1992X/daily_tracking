import { useEffect, useState } from 'react'
import { unlockAudio } from './audio'
import { periodStartKey } from './goals'
import type { AppData } from './goals'
import Focus, { hasPomoRunning } from './screens/Focus'
import Habits from './screens/Habits'
import Home from './screens/Home'
import Meditation from './screens/Meditation'
import Mood from './screens/Mood'
import Reading from './screens/Reading'
import Social from './screens/Social'
import Todo from './screens/Todo'
import {
  exportBackup,
  loadActive,
  parseBackup,
  requestPersistentStorage,
  useCollection,
} from './storage'
import type { Row, StoreName } from './storage'
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
  Route,
  SocialEntry,
  TodoItem,
  Topic,
} from './types'

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
  const goals = useCollection<Goal>('goals')

  useEffect(requestPersistentStorage, [])

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

  const addTodo = (title: string, period: Period, offset: 0 | 1) =>
    todos.upsert({
      id: crypto.randomUUID(),
      title,
      period,
      start: periodStartKey(period, offset),
      done: false,
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

  const stores: Record<StoreName, { items: Row[]; merge(list: Row[]): number }> = {
    meditation,
    books,
    readingLogs,
    habits,
    habitLogs,
    moods,
    focus,
    social,
    todos,
    goals,
  }

  switch (route) {
    case 'todo':
      return (
        <Todo
          data={data}
          goals={goals.items}
          onToggle={toggleTodo}
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
      onAddTodo={addTodo}
      onExport={() => {
        const all = Object.fromEntries(
          (Object.keys(stores) as StoreName[]).map((k) => [k, stores[k].items]),
        ) as Record<StoreName, Row[]>
        void exportBackup(all)
      }}
      onImport={async (file) => {
        try {
          const parsed = await parseBackup(file)
          let added = 0
          for (const k of Object.keys(parsed) as StoreName[]) {
            added += stores[k].merge(parsed[k] ?? [])
          }
          return `${added} Einträge importiert`
        } catch {
          return 'Datei konnte nicht gelesen werden'
        }
      }}
    />
  )
}
