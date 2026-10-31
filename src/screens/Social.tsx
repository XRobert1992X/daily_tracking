import { useState } from 'react'
import { Attach, PhotoBadge } from '../components/Attach'
import { BarChart } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { KIND_COLORS, KindIcon } from '../components/icons'
import { Header, Meter, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { addDays, dayKey, lastDays, shortDate, sum, todayKey, weekKeys } from '../stats'
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

const kindOf = (id: SocialKind) => SOCIAL_KINDS.find((k) => k.id === id)!
const dayOf = (e: SocialEntry) => dayKey(new Date(e.at))
const timeOf = (e: SocialEntry) =>
  new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

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
      <div className="editor-top">
        <div className="rate-meter">
          <span className="muted">Bewertung</span>
          <Meter compact value={rating} max={5} onChange={setRating} />
        </div>
        <button
          className="x"
          aria-label="Eintrag löschen"
          onClick={() => {
            if (confirm('Eintrag löschen?')) {
              onDelete(entry.id)
              onClose()
            }
          }}
        >
          Löschen
        </button>
      </div>
      <textarea
        rows={2}
        value={note}
        placeholder="Kommentar: Was ist passiert, was hast du gelernt?"
        onChange={(e) => setNote(e.target.value)}
      />
      <Attach ownerId={entry.id} />
      <button
        className="ghost primary wide"
        onClick={() => {
          onSave({ ...entry, note: note.trim() || undefined, rating: rating || undefined })
          onClose()
        }}
      >
        Speichern
      </button>
    </div>
  )
}

function EntryRows({
  entries,
  openId,
  setOpenId,
  onSave,
  onDelete,
}: {
  entries: SocialEntry[]
  openId: string | null
  setOpenId: (id: string | null) => void
  onSave: (e: SocialEntry) => void
  onDelete: (id: string) => void
}) {
  return (
    <ul className="erows">
      {entries.map((e) => {
        const open = openId === e.id
        return (
          <li key={e.id}>
            <button className="erow" onClick={() => setOpenId(open ? null : e.id)}>
              <span className="eico" style={{ borderColor: KIND_COLORS[e.kind] }}>
                <KindIcon kind={e.kind} size={16} />
              </span>
              <span className="emain">
                <b>{kindOf(e.kind).short}</b>
                {e.note && <small className="clamp">{e.note}</small>}
              </span>
              <span className="emeta">
                <PhotoBadge ownerId={e.id} />
                {e.rating ? <b className="rate-chip">{e.rating}/5</b> : null}
                <small>{timeOf(e)}</small>
              </span>
            </button>
            {open && (
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
      <div className="tiles">
        {SOCIAL_KINDS.map((k) => (
          <button
            key={k.id}
            className="tile"
            aria-label={`${k.label} hinzufügen`}
            style={{ ['--kc' as string]: KIND_COLORS[k.id] }}
            onClick={() => add(k.id)}
          >
            <span className="tile-head">
              <KindIcon kind={k.id} size={22} />
              <span className="tile-plus">+</span>
            </span>
            <span className="tile-count">{todays.filter((e) => e.kind === k.id).length}</span>
            <span className="tile-label">{k.short}</span>
            <small className="muted">
              Woche {entries.filter((e) => e.kind === k.id && week.has(dayOf(e))).length}
            </small>
          </button>
        ))}
      </div>

      {todays.length > 0 && (
        <section className="card tight">
          <p className="muted">Heute · {todays.length}</p>
          <EntryRows
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

function dayTitle(key: string) {
  if (key === todayKey()) return 'Heute'
  if (key === dayKey(addDays(new Date(), -1))) return 'Gestern'
  return new Date(`${key}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
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
  const [filter, setFilter] = useState<SocialKind | 'all'>('all')
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

  const groups = new Map<string, SocialEntry[]>()
  for (const e of [...selected].reverse().slice(0, 80)) {
    const k = dayOf(e)
    groups.set(k, [...(groups.get(k) ?? []), e])
  }

  return (
    <>
      <div className="stats four">
        <Stat label="Indirekt" value={String(count('indirect'))} />
        <Stat label="Angespr." value={String(approach)} />
        <Stat label="Kontakte" value={String(contact)} />
        <Stat label="Dates" value={String(date)} />
      </div>
      <p className="hint tight-hint">Letzte 30 Tage</p>

      <section className="card">
        <div className="quote-row">
          <span>Angesprochen → Kontakt</span>
          <b className="chip">{pct(contact, approach)}</b>
        </div>
        <div className="quote-row">
          <span>Kontakt → Date</span>
          <b className="chip">{pct(date, contact)}</b>
        </div>
        {rNow !== null && (
          <p className="trend">
            <b>{rNow.toFixed(1)}</b>
            <span className="muted"> Ø Bewertung (letzte 10)</span>
            {rBefore !== null && (
              <span className={rNow > rBefore ? 'ok' : rNow < rBefore ? 'bad' : 'muted'}>
                {' '}
                {rNow > rBefore ? '▲' : rNow < rBefore ? '▼' : '='} vorher {rBefore.toFixed(1)}
              </span>
            )}
          </p>
        )}
      </section>

      <div className="chips scroll">
        <button className={`chipbtn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Alle
        </button>
        {SOCIAL_KINDS.map((k) => (
          <button
            key={k.id}
            className={`chipbtn ${filter === k.id ? 'on' : ''}`}
            onClick={() => setFilter(k.id)}
          >
            {k.short}
          </button>
        ))}
      </div>

      <section className="card">
        <p className="muted">Pro Tag (14 Tage)</p>
        <BarChart
          data={days.map((k) => ({ key: k, value: perDay.get(k) ?? 0, label: shortDate(k) }))}
        />
      </section>

      <section className="card tight">
        <p className="muted">Einträge</p>
        {selected.length === 0 && <p className="hint">Noch keine Einträge.</p>}
        {[...groups].map(([day, list]) => (
          <div key={day} className="daygroup">
            <div className="dayhead">
              <b>{dayTitle(day)}</b>
              <small className="muted">{list.length}</small>
            </div>
            <EntryRows
              entries={list}
              openId={openId}
              setOpenId={setOpenId}
              onSave={onSave}
              onDelete={onDelete}
            />
          </div>
        ))}
      </section>
    </>
  )
}
