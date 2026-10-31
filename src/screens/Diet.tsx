import { useState } from 'react'
import { CumTarget, TargetBars } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Attach, PhotoBadge } from '../components/Attach'
import { DayNav, Header, MarkerBar, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, sum, todayKey, weekKeys } from '../stats'
import { DIET_ACTIVITIES } from '../types'
import type { DietEntry, Goal } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onTdee: (n: number) => void
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: DietEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE')
const dayOf = (e: DietEntry) => dayKey(new Date(e.at))

function summarize(entries: DietEntry[], tdee: number) {
  const eaten = sum(entries.filter((e) => e.kind === 'food').map((e) => e.kcal))
  const burned = sum(entries.filter((e) => e.kind === 'activity').map((e) => e.kcal))
  return { eaten, burned, hasFood: eaten > 0, balance: tdee + burned - eaten }
}

function monthKeys() {
  const now = new Date()
  const n = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1)))
}

export default function Diet(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'tag' | 'verlauf' | 'ziele'>('tag')

  return (
    <main className="app">
      <Header title="Diät" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'tag', label: 'Tag' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'tag' && <DayView {...props} />}
      {tab === 'verlauf' && <History data={data} goals={goals} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="diet"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

// Fortschrittsbalken mit Zielmarkierung: siehe MarkerBar in ui.tsx

function DayView({ data, goals, onTdee, onSave, onDelete }: Props) {
  const [day, setDay] = useState(todayKey())
  const [kind, setKind] = useState<'food' | 'activity'>('food')
  const [kcal, setKcal] = useState('')
  const [label, setLabel] = useState('')
  const [activity, setActivity] = useState(DIET_ACTIVITIES[0])
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(() => crypto.randomUUID())
  const [openId, setOpenId] = useState<string | null>(null)
  const [tdeeText, setTdeeText] = useState(String(data.dietTdee))

  const entries = data.diet.filter((e) => dayOf(e) === day)
  const s = summarize(entries, data.dietTdee)
  const burnGoal = goals.find((g) => g.metric === 'burned' && g.period === 'day')?.target
  const value = parseInt(kcal, 10)
  const valid = value > 0

  const add = () => {
    const at = day === todayKey() ? new Date().toISOString() : `${day}T12:00:00`
    onSave({
      id: draft,
      at: new Date(at).toISOString(),
      kind,
      label: kind === 'food' ? label.trim() || 'Essen' : activity,
      kcal: value,
      note: note.trim() || undefined,
    })
    setKcal('')
    setLabel('')
    setNote('')
    setDraft(crypto.randomUUID())
  }

  return (
    <>
      <DayNav day={day} onChange={setDay} />

      <section className="card">
        <p className="muted">{s.hasFood ? (s.balance >= 0 ? 'Defizit' : 'Überschuss') : 'Bilanz'}</p>
        <p className={`bignum ${s.hasFood ? (s.balance >= 0 ? 'ok' : 'bad') : ''}`}>
          {s.hasFood ? fmt(Math.abs(s.balance)) : '–'}
          <small> kcal</small>
        </p>
        <div className="triple">
          <div>
            <b>{fmt(data.dietTdee + s.burned)}</b>
            <small className="muted">Verbrauch</small>
          </div>
          <div>
            <b>{fmt(s.eaten)}</b>
            <small className="muted">Gegessen</small>
          </div>
          <div>
            <b>{fmt(s.burned)}</b>
            <small className="muted">Aktivität</small>
          </div>
        </div>
        {!s.hasFood && <p className="hint">Trage Essen ein, dann wird das Defizit berechnet.</p>}
        {burnGoal !== undefined && (
          <div className="burn-goal">
            <div className="burn-top">
              <span className="muted">Verbrannt (Aktivität)</span>
              <b>
                {fmt(s.burned)} / {fmt(burnGoal)} kcal
              </b>
            </div>
            <MarkerBar value={s.burned} target={burnGoal} />
          </div>
        )}
        <label className="tdee">
          <span className="muted">Grundverbrauch pro Tag (kcal)</span>
          <input
            type="number"
            inputMode="numeric"
            value={tdeeText}
            onChange={(e) => setTdeeText(e.target.value)}
            onBlur={() => {
              const n = parseInt(tdeeText, 10)
              if (n >= 800 && n <= 6000) onTdee(n)
              else setTdeeText(String(data.dietTdee))
            }}
          />
        </label>
      </section>

      <section className="card">
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { id: 'food', label: 'Essen' },
            { id: 'activity', label: 'Aktivität' },
          ]}
        />
        <div className="duration spaced">
          <label className="field">
            <span className="muted">{kind === 'food' ? 'Gegessen (kcal)' : 'Verbrannt (kcal)'}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={kcal}
              placeholder="kcal"
              onChange={(e) => setKcal(e.target.value)}
            />
          </label>
          {kind === 'food' ? (
            <label className="field">
              <span className="muted">Name (optional)</span>
              <input
                type="text"
                value={label}
                placeholder="z. B. Mittagessen"
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              <span className="muted">Aktivität</span>
              <select value={activity} onChange={(e) => setActivity(e.target.value)}>
                {DIET_ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="field">
          <span className="muted">Kommentar (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Attach ownerId={draft} />
        <button className="cta spaced" disabled={!valid} onClick={add}>
          {kind === 'food' ? 'Essen eintragen' : 'Aktivität eintragen'}
        </button>
      </section>

      {entries.length > 0 && (
        <section className="card tight">
          <p className="muted">Einträge · {entries.length}</p>
          <ul className="erows">
            {[...entries].reverse().map((e) => (
              <li key={e.id}>
                <button className="erow" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                  <span className={`kdot ${e.kind}`}>{e.kind === 'food' ? '+' : '−'}</span>
                  <span className="emain">
                    <b>{e.label}</b>
                    {e.note && <small className="clamp">{e.note}</small>}
                  </span>
                  <span className="emeta">
                    <PhotoBadge ownerId={e.id} />
                    <b className={e.kind === 'activity' ? 'ok' : ''}>
                      {e.kind === 'food' ? '+' : '−'}
                      {fmt(e.kcal)}
                    </b>
                  </span>
                </button>
                {openId === e.id && (
                  <EntryEditor
                    entry={e}
                    onSave={onSave}
                    onDelete={onDelete}
                    onClose={() => setOpenId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function EntryEditor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: DietEntry
  onSave: (e: DietEntry) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState(entry.note ?? '')
  return (
    <div className="editor">
      <textarea
        rows={2}
        value={note}
        placeholder="Kommentar"
        onChange={(e) => setNote(e.target.value)}
      />
      <Attach ownerId={entry.id} />
      <div className="row spaced">
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
            onSave({ ...entry, note: note.trim() || undefined })
            onClose()
          }}
        >
          Speichern
        </button>
      </div>
    </div>
  )
}

function History({ data, goals }: { data: AppData; goals: Goal[] }) {
  const [range, setRange] = useState<'woche' | 'monat'>('woche')
  const [mode, setMode] = useState<'kum' | 'tag'>('kum')
  const days = range === 'woche' ? weekKeys() : monthKeys()
  const today = todayKey()
  const byDay = new Map<string, DietEntry[]>()
  for (const e of data.diet) byDay.set(dayOf(e), [...(byDay.get(dayOf(e)) ?? []), e])
  const sums = days.map((k) => ({ k, ...summarize(byDay.get(k) ?? [], data.dietTdee) }))
  const past = sums.filter((s) => s.k <= today)

  // Kumuliert gilt das Wochen- bzw. Monatsziel, pro Tag das Tagesziel
  const goalPeriod = mode === 'kum' ? (range === 'woche' ? 'week' : 'month') : 'day'
  const burnGoal = goals.find((g) => g.metric === 'burned' && g.period === goalPeriod)?.target
  const defGoal = goals.find((g) => g.metric === 'deficit' && g.period === goalPeriod)?.target
  const label = (k: string, i: number) =>
    range === 'woche' ? ['M', 'D', 'M', 'D', 'F', 'S', 'S'][i] : String(new Date(`${k}T12:00:00`).getDate())

  // Laufender Gesamtstand; Tage in der Zukunft haben keinen Wert
  const cum = (pick: (s: (typeof sums)[number]) => number) => {
    let run = 0
    return sums.map((s) => (s.k > today ? null : (run += pick(s))))
  }
  const burnCum = cum((s) => s.burned)
  const defCum = cum((s) => (s.hasFood ? s.balance : 0))

  const foodDays = past.filter((s) => s.hasFood)
  const totalDeficit = sum(foodDays.map((s) => s.balance))
  const avgDeficit = foodDays.length ? totalDeficit / foodDays.length : 0
  const totalBurned = sum(past.map((s) => s.burned))
  const shortDay = (k: string) =>
    new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
  const listDays = past.filter((s) => s.hasFood || s.burned > 0).reverse()
  const goalWord = { day: 'Tagesziel', week: 'Wochenziel', month: 'Monatsziel' }[goalPeriod]
  const goalHint = (what: string) =>
    `Setze unter „Ziele“ ein ${goalWord} für ${what}, dann erscheint die Markierung.`

  return (
    <>
      <Seg
        value={range}
        onChange={setRange}
        options={[
          { id: 'woche', label: 'Woche' },
          { id: 'monat', label: 'Monat' },
        ]}
      />
      <div className="stats">
        <Stat label="Defizit gesamt" value={fmt(totalDeficit)} />
        <Stat label="Ø pro Tag" value={fmt(avgDeficit)} />
        <Stat label="Verbrannt" value={fmt(totalBurned)} />
      </div>
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { id: 'kum', label: 'Kumuliert' },
          { id: 'tag', label: 'Pro Tag' },
        ]}
      />

      <section className="card">
        <p className="muted">
          {mode === 'kum' ? 'Verbrannte kcal kumuliert' : 'Verbrannte kcal pro Tag'}
        </p>
        {mode === 'kum' ? (
          <CumTarget labels={sums.map((s, i) => label(s.k, i))} values={burnCum} target={burnGoal} />
        ) : (
          <TargetBars
            data={sums.map((s, i) => ({ key: s.k, value: s.burned, label: label(s.k, i) }))}
            target={burnGoal}
          />
        )}
        {burnGoal === undefined && <p className="hint">{goalHint('verbrannte kcal')}</p>}
      </section>

      <section className="card">
        <p className="muted">
          {mode === 'kum'
            ? 'Defizit kumuliert (Überschuss zieht die Kurve nach unten)'
            : 'Defizit (grün) und Überschuss (orange) pro Tag'}
        </p>
        {mode === 'kum' ? (
          <CumTarget labels={sums.map((s, i) => label(s.k, i))} values={defCum} target={defGoal} />
        ) : (
          <TargetBars
            signed
            data={sums.map((s, i) => ({
              key: s.k,
              value: s.hasFood ? s.balance : 0,
              label: label(s.k, i),
            }))}
            target={defGoal}
          />
        )}
      </section>

      <section className="card tight">
        <p className="muted">Tage</p>
        {listDays.length === 0 && <p className="hint">Noch keine Einträge in diesem Zeitraum.</p>}
        <ul className="erows">
          {listDays.map((s) => (
            <li key={s.k}>
              <div className="erow static">
                <span className="emain">
                  <b>{shortDay(s.k)}</b>
                  <small>
                    Gegessen {fmt(s.eaten)} · Aktivität {fmt(s.burned)}
                  </small>
                </span>
                <span className="emeta">
                  <b className={s.hasFood ? (s.balance >= 0 ? 'ok' : 'bad') : ''}>
                    {s.hasFood ? `${s.balance >= 0 ? '−' : '+'}${fmt(Math.abs(s.balance))}` : '–'}
                  </b>
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="hint">Bilanz: − = Defizit, + = Überschuss. Tage ohne Essen zählen nicht ins Defizit.</p>
      </section>
    </>
  )
}
