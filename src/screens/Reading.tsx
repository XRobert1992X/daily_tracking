import { useState } from 'react'
import { Attach, RowPhotos } from '../components/Attach'
import { BarChart, Heatmap } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, ProgressBar, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayStreak, lastDays, shortDate, sum, todayKey, weekKeys } from '../stats'
import type { Book, Goal, ReadingLog } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onUpsertBook: (b: Book) => void
  onRemoveBook: (id: string) => void
  onUpsertLog: (l: ReadingLog) => void
  onRemoveLog: (id: string) => void
  onBack: () => void
}

export default function Reading(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'buecher' | 'verlauf' | 'ziele'>('buecher')
  const [bookId, setBookId] = useState<string | null>(null)
  const book = data.books.find((b) => b.id === bookId)

  if (book) {
    return (
      <BookDetail
        book={book}
        logs={data.readingLogs.filter((l) => l.bookId === book.id)}
        onBack={() => setBookId(null)}
        onUpsertBook={props.onUpsertBook}
        onRemoveBook={(id) => {
          props.onRemoveBook(id)
          setBookId(null)
        }}
        onUpsertLog={props.onUpsertLog}
        onRemoveLog={props.onRemoveLog}
      />
    )
  }

  return (
    <main className="app">
      <Header title="Lesen" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'buecher', label: 'Bücher' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'buecher' && (
        <Books
          data={data}
          onOpen={setBookId}
          onAdd={(b) => {
            props.onUpsertBook(b)
            setBookId(b.id)
          }}
        />
      )}
      {tab === 'verlauf' && <Overview data={data} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="reading"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function bookStats(book: Book, logs: ReadingLog[]) {
  const pages = sum(logs.map((l) => l.pages))
  const minutes = sum(logs.map((l) => l.minutes))
  return { pages, minutes, total: book.totalPages ?? 0 }
}

function Books({
  data,
  onOpen,
  onAdd,
}: {
  data: AppData
  onOpen: (id: string) => void
  onAdd: (b: Book) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pages, setPages] = useState('')

  const current = data.books.filter((b) => !b.finishedAt)
  const done = data.books.filter((b) => b.finishedAt)

  const card = (b: Book) => {
    const s = bookStats(b, data.readingLogs.filter((l) => l.bookId === b.id))
    return (
      <button key={b.id} className="card book" onClick={() => onOpen(b.id)}>
        <div className="book-top">
          <b>{b.title}</b>
          <span className="muted">{b.author}</span>
        </div>
        {s.total > 0 && <ProgressBar value={s.pages} max={s.total} />}
        <small className="muted">
          {s.total > 0 ? `${s.pages} / ${s.total} Seiten · ` : s.pages > 0 ? `${s.pages} Seiten · ` : ''}
          {s.minutes} Min
        </small>
      </button>
    )
  }

  return (
    <>
      {current.length === 0 && !adding && (
        <section className="card">
          <p className="muted">Noch kein Buch</p>
          <p className="hint">Füge das Buch hinzu, das du gerade liest.</p>
        </section>
      )}
      {current.map(card)}

      {adding ? (
        <section className="card">
          <p className="muted">Neues Buch</p>
          <label className="field">
            <span className="muted">Titel</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Atomic Habits"
            />
          </label>
          <label className="field">
            <span className="muted">Autor (optional)</span>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="field">
            <span className="muted">Seitenzahl (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            />
          </label>
          <div className="row">
            <button className="ghost" onClick={() => setAdding(false)}>
              Abbrechen
            </button>
            <button
              className="ghost primary"
              disabled={!title.trim()}
              onClick={() => {
                onAdd({
                  id: crypto.randomUUID(),
                  title: title.trim(),
                  author: author.trim() || undefined,
                  totalPages: parseInt(pages, 10) > 0 ? parseInt(pages, 10) : undefined,
                  startedAt: new Date().toISOString(),
                })
                setTitle('')
                setAuthor('')
                setPages('')
                setAdding(false)
              }}
            >
              Hinzufügen
            </button>
          </div>
        </section>
      ) : (
        <button className="ghost wide" onClick={() => setAdding(true)}>
          + Buch hinzufügen
        </button>
      )}

      {done.length > 0 && (
        <>
          <p className="muted section">Gelesen</p>
          {done.map(card)}
        </>
      )}
    </>
  )
}

function BookDetail({
  book,
  logs,
  onBack,
  onUpsertBook,
  onRemoveBook,
  onUpsertLog,
  onRemoveLog,
}: {
  book: Book
  logs: ReadingLog[]
  onBack: () => void
  onUpsertBook: (b: Book) => void
  onRemoveBook: (id: string) => void
  onUpsertLog: (l: ReadingLog) => void
  onRemoveLog: (id: string) => void
}) {
  const [minutes, setMinutes] = useState('')
  const [pages, setPages] = useState('')
  const [day, setDay] = useState(todayKey())
  const [draft, setDraft] = useState(() => crypto.randomUUID())
  const s = bookStats(book, logs)
  const m = parseInt(minutes, 10) || 0
  const p = parseInt(pages, 10) || 0
  const sorted = [...logs].sort((a, b) => b.day.localeCompare(a.day))

  return (
    <main className="app">
      <Header title={book.title.length > 18 ? `${book.title.slice(0, 17)}…` : book.title} onBack={onBack} />

      <section className="card">
        {book.author && <p className="muted">{book.author}</p>}
        {s.total > 0 ? (
          <>
            <p className="goal-num">
              <b>{s.pages}</b>
              <span className="muted"> / {s.total} Seiten</span>
            </p>
            <ProgressBar value={s.pages} max={s.total} />
          </>
        ) : (
          <p className="goal-num">
            <b>{s.pages}</b>
            <span className="muted"> Seiten gelesen</span>
          </p>
        )}
        <p className="hint">
          {s.minutes} Min gelesen
          {book.finishedAt && ` · beendet am ${new Date(book.finishedAt).toLocaleDateString('de-DE')}`}
        </p>
        <Attach ownerId={book.id} />
      </section>

      <section className="card">
        <p className="muted">Lesen eintragen</p>
        <div className="duration">
          <label className="field">
            <span className="muted">Minuten</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="muted">Seiten</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span className="muted">Datum</span>
          <input type="date" value={day} max={todayKey()} onChange={(e) => setDay(e.target.value)} />
        </label>
        <Attach ownerId={draft} />
        <button
          className="cta spaced"
          disabled={(m <= 0 && p <= 0) || !day}
          onClick={() => {
            onUpsertLog({ id: draft, bookId: book.id, day, minutes: m, pages: p })
            setMinutes('')
            setPages('')
            setDraft(crypto.randomUUID())
          }}
        >
          Eintragen
        </button>
      </section>

      {sorted.length > 0 && (
        <section className="card">
          <p className="muted">Einträge</p>
          <ul className="list">
            {sorted.map((l) => (
              <li key={l.id}>
                <div>
                  <b>{shortDate(l.day)}</b>
                  <small className="muted">
                    {l.minutes} Min · {l.pages} Seiten
                  </small>
                </div>
                <RowPhotos ownerId={l.id} />
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Eintrag löschen?') && onRemoveLog(l.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row">
        <button
          className="ghost"
          onClick={() =>
            onUpsertBook({
              ...book,
              finishedAt: book.finishedAt ? undefined : new Date().toISOString(),
            })
          }
        >
          {book.finishedAt ? 'Wieder öffnen' : '✓ Als gelesen markieren'}
        </button>
        <button
          className="ghost danger"
          onClick={() => confirm('Buch samt Einträgen löschen?') && onRemoveBook(book.id)}
        >
          Löschen
        </button>
      </div>
    </main>
  )
}

function Overview({ data }: { data: AppData }) {
  const byDay = new Map<string, { min: number; pages: number }>()
  for (const l of data.readingLogs) {
    const e = byDay.get(l.day) ?? { min: 0, pages: 0 }
    e.min += l.minutes
    e.pages += l.pages
    byDay.set(l.day, e)
  }
  const week = weekKeys()
  const weekMin = sum(week.map((k) => byDay.get(k)?.min ?? 0))
  const weekPages = sum(week.map((k) => byDay.get(k)?.pages ?? 0))
  const days = lastDays(14)
  const finished = data.books.filter((b) => b.finishedAt).length

  return (
    <>
      <div className="stats">
        <Stat label="Min diese Woche" value={String(weekMin)} />
        <Stat label="Seiten diese Woche" value={String(weekPages)} />
        <Stat label="Serie (Tage)" value={String(dayStreak(new Set(byDay.keys())))} />
      </div>

      <section className="card">
        <p className="muted">Minuten pro Tag (14 Tage)</p>
        <BarChart
          data={days.map((k) => ({ key: k, value: byDay.get(k)?.min ?? 0, label: shortDate(k) }))}
        />
        <p className="hint">{finished} Bücher gelesen</p>
      </section>

      <section className="card">
        <p className="muted">Letzte 5 Wochen</p>
        <Heatmap
          values={new Map([...byDay].map(([k, v]) => [k, v.min]))}
          level={(v) => (v === 0 ? 0 : v < 15 ? 1 : v < 30 ? 2 : 3)}
        />
      </section>
    </>
  )
}
