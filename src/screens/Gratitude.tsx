import { useState } from 'react'
import { Attach } from '../components/Attach'
import { Heatmap } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { addDays, dayKey, dayStreak, sum, todayKey, weekKeys } from '../stats'
import type { Goal, GratitudeEntry } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: GratitudeEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const dayOf = (e: GratitudeEntry) => dayKey(new Date(e.at))
const timeOf = (e: GratitudeEntry) =>
  new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export default function Gratitude(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'heute' | 'verlauf' | 'ziele'>('heute')

  return (
    <main className="app">
      <Header title="Dankbarkeit" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'heute', label: 'Heute' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'heute' && <Today entries={data.gratitude} onSave={props.onSave} onDelete={props.onDelete} />}
      {tab === 'verlauf' && (
        <History entries={data.gratitude} onSave={props.onSave} onDelete={props.onDelete} />
      )}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="gratitude"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function ItemInputs({
  values,
  onChange,
}: {
  values: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <div className="gitems">
      {values.map((v, i) => (
        <label key={i} className="gitem">
          <span className="gnum">{i + 1}</span>
          <input
            type="text"
            value={v}
            placeholder={i === 0 ? 'Wofür bist du dankbar?' : 'Noch etwas…'}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
    </div>
  )
}

function EntryCard({
  entry,
  onSave,
  onDelete,
}: {
  entry: GratitudeEntry
  onSave: (e: GratitudeEntry) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([...entry.items, ''])

  return (
    <li className="gentry">
      <div className="gentry-top">
        <ul className="gbullets">
          {entry.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <small className="muted">{timeOf(entry)}</small>
        <button className="x" aria-label="Bearbeiten" onClick={() => setOpen((o) => !o)}>
          ✎
        </button>
      </div>
      {open && (
        <div className="editor">
          <ItemInputs values={items} onChange={setItems} />
          <button className="x add-line" onClick={() => setItems([...items, ''])}>
            + Zeile
          </button>
          <Attach ownerId={entry.id} />
          <div className="row spaced">
            <button
              className="ghost danger"
              onClick={() => {
                if (confirm('Eintrag löschen?')) onDelete(entry.id)
              }}
            >
              Löschen
            </button>
            <button
              className="ghost primary"
              onClick={() => {
                const clean = items.map((t) => t.trim()).filter(Boolean)
                if (clean.length) onSave({ ...entry, items: clean })
                setOpen(false)
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function Today({
  entries,
  onSave,
  onDelete,
}: {
  entries: GratitudeEntry[]
  onSave: (e: GratitudeEntry) => void
  onDelete: (id: string) => void
}) {
  const [values, setValues] = useState(['', '', ''])
  const [draft, setDraft] = useState(() => crypto.randomUUID())
  const today = todayKey()
  const todays = entries.filter((e) => dayOf(e) === today)
  const clean = values.map((t) => t.trim()).filter(Boolean)

  return (
    <>
      <section className="card">
        <p className="muted">Wofür bist du heute dankbar?</p>
        <ItemInputs values={values} onChange={setValues} />
        <Attach ownerId={draft} />
        <button
          className="cta spaced"
          disabled={clean.length === 0}
          onClick={() => {
            onSave({ id: draft, at: new Date().toISOString(), items: clean })
            setValues(['', '', ''])
            setDraft(crypto.randomUUID())
          }}
        >
          Speichern
        </button>
      </section>

      {todays.length > 0 && (
        <section className="card tight">
          <p className="muted">Heute · {todays.length}</p>
          <ul className="gentries">
            {[...todays].reverse().map((e) => (
              <EntryCard key={e.id} entry={e} onSave={onSave} onDelete={onDelete} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function History({
  entries,
  onSave,
  onDelete,
}: {
  entries: GratitudeEntry[]
  onSave: (e: GratitudeEntry) => void
  onDelete: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const perDay = new Map<string, number>()
  for (const e of entries) perDay.set(dayOf(e), (perDay.get(dayOf(e)) ?? 0) + 1)
  const weekSet = new Set(weekKeys())
  const weekCount = entries.filter((e) => weekSet.has(dayOf(e))).length
  const q = query.trim().toLowerCase()
  const shown = entries.filter((e) => !q || e.items.some((t) => t.toLowerCase().includes(q)))

  const groups = new Map<string, GratitudeEntry[]>()
  for (const e of [...shown].reverse().slice(0, 80)) {
    groups.set(dayOf(e), [...(groups.get(dayOf(e)) ?? []), e])
  }
  const today = todayKey()
  const yesterday = dayKey(addDays(new Date(), -1))
  const title = (k: string) =>
    k === today
      ? 'Heute'
      : k === yesterday
        ? 'Gestern'
        : new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          })

  return (
    <>
      <div className="stats">
        <Stat label="Einträge" value={String(entries.length)} />
        <Stat label="Serie (Tage)" value={String(dayStreak(new Set(perDay.keys())))} />
        <Stat label="Diese Woche" value={String(weekCount)} />
      </div>

      <section className="card">
        <p className="muted">Letzte 5 Wochen</p>
        <Heatmap values={perDay} level={(v) => (v === 0 ? 0 : v < 2 ? 1 : v < 3 ? 2 : 3)} />
        <p className="hint">{sum([...perDay.values()])} Einträge insgesamt</p>
      </section>

      <label className="search">
        <input
          type="text"
          value={query}
          placeholder="Suchen…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <section className="card tight">
        <p className="muted">Einträge</p>
        {shown.length === 0 && <p className="hint">{q ? 'Nichts gefunden.' : 'Noch keine Einträge.'}</p>}
        {[...groups].map(([day, list]) => (
          <div key={day} className="daygroup">
            <div className="dayhead">
              <b>{title(day)}</b>
              <small className="muted">{list.length}</small>
            </div>
            <ul className="gentries">
              {list.map((e) => (
                <EntryCard key={e.id} entry={e} onSave={onSave} onDelete={onDelete} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  )
}
