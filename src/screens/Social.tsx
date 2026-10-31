import { useState } from 'react'
import { BarChart } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, lastDays, shortDate, sum, todayKey, weekKeys } from '../stats'
import { SOCIAL_KINDS } from '../types'
import type { Goal, SocialEntry, SocialKind } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const RATINGS = ['😞', '🙁', '😐', '🙂', '😄']
const kindOf = (id: SocialKind) => SOCIAL_KINDS.find((k) => k.id === id)!
const dayOf = (e: SocialEntry) => dayKey(new Date(e.at))

export default function Social(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'heute' | 'verlauf' | 'ziele'>('heute')

  return (
    <main className="app">
      <Header title="Soziale Interaktion" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'heute', label: 'Heute' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'heute' && (
        <Today entries={data.social} onSave={props.onSave} onDelete={props.onDelete} />
      )}
      {tab === 'verlauf' && (
        <History entries={data.social} onSave={props.onSave} onDelete={props.onDelete} />
      )}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="social"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function Editor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: SocialEntry
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState(entry.note ?? '')
  const [rating, setRating] = useState(entry.rating ?? 0)

  return (
    <div className="editor">
      <p className="muted">Wie lief es? (optional)</p>
      <div className="scale mini">
        {RATINGS.map((r, i) => (
          <button
            key={i}
            className={rating === i + 1 ? 'on' : ''}
            onClick={() => setRating(rating === i + 1 ? 0 : i + 1)}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        value={note}
        placeholder="Kommentar: Was ist passiert, was hast du gelernt?"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row">
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm('Eintrag löschen?')) {
              onDelete(entry.id)
              onClose()
            }
          }}
        >
          Löschen
        </button>
        <button
          className="ghost primary"
          onClick={() => {
            onSave({
              ...entry,
              note: note.trim() || undefined,
              rating: rating || undefined,
            })
            onClose()
          }}
        >
          Speichern
        </button>
      </div>
    </div>
  )
}

function EntryList({
  entries,
  openId,
  setOpenId,
  onSave,
  onDelete,
  withDate,
}: {
  entries: SocialEntry[]
  openId: string | null
  setOpenId: (id: string | null) => void
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
  withDate?: boolean
}) {
  return (
    <ul className="list">
      {entries.map((e) => {
        const k = kindOf(e.kind)
        const d = new Date(e.at)
        return (
          <li key={e.id} className="entry">
            <div className="entry-row">
              <span className="entry-icon">{k.icon}</span>
              <div>
                <b>
                  {k.label} {e.rating ? RATINGS[e.rating - 1] : ''}
                </b>
                <small className="muted">
                  {withDate &&
                    `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} `}
                  {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </small>
                {e.note && <p className="note">{e.note}</p>}
              </div>
              <button
                className="x"
                aria-label="Kommentar bearbeiten"
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
              >
                ✎
              </button>
            </div>
            {openId === e.id && (
              <Editor
                key={e.id}
                entry={e}
                onSave={onSave}
                onDelete={onDelete}
                onClose={() => setOpenId(null)}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Today({
  entries,
  onSave,
  onDelete,
}: {
  entries: SocialEntry[]
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const today = todayKey()
  const week = new Set(weekKeys())
  const todays = entries.filter((e) => dayOf(e) === today)

  const add = (kind: SocialKind) => {
    const e: SocialEntry = { id: crypto.randomUUID(), at: new Date().toISOString(), kind }
    onSave(e)
    setOpenId(e.id)
    navigator.vibrate?.(15)
  }

  return (
    <>
      {SOCIAL_KINDS.map((k) => (
        <section key={k.id} className="card social-row">
          <span className="habit-icon">{k.icon}</span>
          <div className="habit-text">
            <b>{k.label}</b>
            <small className="muted">
              Heute {todays.filter((e) => e.kind === k.id).length} · Woche{' '}
              {entries.filter((e) => e.kind === k.id && week.has(dayOf(e))).length}
            </small>
          </div>
          <button className="plus" aria-label={`${k.label} hinzufügen`} onClick={() => add(k.id)}>
            +
          </button>
        </section>
      ))}

      {todays.length > 0 && (
        <section className="card">
          <p className="muted">Heute</p>
          <EntryList
            entries={[...todays].reverse()}
            openId={openId}
            setOpenId={setOpenId}
            onSave={onSave}
            onDelete={onDelete}
          />
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
  entries: SocialEntry[]
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
}) {
  const [filter, setFilter] = useState<SocialKind | 'all'>('approach')
  const [openId, setOpenId] = useState<string | null>(null)

  const since = new Set(lastDays(30))
  const recent = entries.filter((e) => since.has(dayOf(e)))
  const count = (k: SocialKind) => recent.filter((e) => e.kind === k).length
  const approach = count('approach')
  const contact = count('contact')
  const date = count('date')
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–')

  const rated = entries.filter((e) => e.rating)
  const avg = (list: SocialEntry[]) =>
    list.length ? sum(list.map((e) => e.rating ?? 0)) / list.length : null
  const rNow = avg(rated.slice(-10))
  const rBefore = avg(rated.slice(-20, -10))

  const selected = entries.filter((e) => filter === 'all' || e.kind === filter)
  const perDay = new Map<string, number>()
  for (const e of selected) perDay.set(dayOf(e), (perDay.get(dayOf(e)) ?? 0) + 1)
  const days = lastDays(14)

  return (
    <>
      <p className="muted section">Letzte 30 Tage</p>
      <div className="stats">
        <Stat label="Angesprochen" value={String(approach)} />
        <Stat label="Kontakte" value={String(contact)} />
        <Stat label="Dates" value={String(date)} />
      </div>

      <section className="card">
        <p className="muted">Quoten</p>
        <ul className="list">
          <li>
            <div>
              <b>Angesprochen → Kontakt</b>
            </div>
            <span className="chip">{pct(contact, approach)}</span>
          </li>
          <li>
            <div>
              <b>Kontakt → Date</b>
            </div>
            <span className="chip">{pct(date, contact)}</span>
          </li>
        </ul>
        {rNow !== null && (
          <p className="trend">
            <b>{rNow.toFixed(1)}</b>
            <span className="muted"> Ø Bewertung (letzte 10)</span>
            {rBefore !== null && (
              <span className={rNow > rBefore ? 'ok' : rNow < rBefore ? 'bad' : 'muted'}>
                {' '}
                {rNow > rBefore ? '▲ besser' : rNow < rBefore ? '▼ schlechter' : '= gleich'} (vorher{' '}
                {rBefore.toFixed(1)})
              </span>
            )}
          </p>
        )}
      </section>

      <div className="chips">
        <button className={`chipbtn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Alle
        </button>
        {SOCIAL_KINDS.map((k) => (
          <button
            key={k.id}
            className={`chipbtn ${filter === k.id ? 'on' : ''}`}
            onClick={() => setFilter(k.id)}
          >
            {k.icon} {k.label}
          </button>
        ))}
      </div>

      <section className="card">
        <p className="muted">Pro Tag (14 Tage)</p>
        <BarChart
          data={days.map((k) => ({ key: k, value: perDay.get(k) ?? 0, label: shortDate(k) }))}
        />
      </section>

      <section className="card">
        <p className="muted">Einträge</p>
        {selected.length === 0 && <p className="hint">Noch keine Einträge.</p>}
        <EntryList
          entries={[...selected].reverse().slice(0, 60)}
          openId={openId}
          setOpenId={setOpenId}
          onSave={onSave}
          onDelete={onDelete}
          withDate
        />
      </section>
    </>
  )
}
