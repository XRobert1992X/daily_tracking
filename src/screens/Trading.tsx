import { useState } from 'react'
import { CumLine, TargetBars } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Attach, PhotoBadge } from '../components/Attach'
import { DayNav, Header, MarkerBar, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dayKey, shortDate, sum, todayKey, weekKeys } from '../stats'
import type { Goal, TradeEntry } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: TradeEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const eur = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${eur(Math.abs(n))}`
const dayOf = (e: TradeEntry) => dayKey(new Date(e.at))
const tone = (n: number) => (n > 0 ? 'ok' : n < 0 ? 'bad' : '')

export default function Trading(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'tag' | 'verlauf' | 'ziele'>('tag')

  return (
    <main className="app">
      <Header title="Trading" onBack={onBack} />
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
          topic="trading"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function DayView({ data, goals, onSave, onDelete }: Props) {
  const [day, setDay] = useState(todayKey())
  const [kind, setKind] = useState<'win' | 'loss'>('win')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(() => crypto.randomUUID())
  const [openId, setOpenId] = useState<string | null>(null)

  const entries = data.trades.filter((e) => dayOf(e) === day)
  const pnl = sum(entries.map((e) => e.amount))
  const wins = entries.filter((e) => e.amount > 0).length
  const losses = entries.filter((e) => e.amount < 0).length
  const goal = goals.find((g) => g.metric === 'pnl' && g.period === 'day')?.target
  const value = parseFloat(amount.replace(',', '.'))
  const valid = value > 0

  const add = () => {
    const at = day === todayKey() ? new Date() : new Date(`${day}T12:00:00`)
    onSave({
      id: draft,
      at: at.toISOString(),
      amount: kind === 'win' ? value : -value,
      label: label.trim() || undefined,
      note: note.trim() || undefined,
    })
    setAmount('')
    setLabel('')
    setNote('')
    setDraft(crypto.randomUUID())
  }

  return (
    <>
      <DayNav day={day} onChange={setDay} />

      <section className="card">
        <p className="muted">Ergebnis</p>
        <p className={`bignum ${tone(pnl)}`}>{entries.length ? signed(pnl) : '–'}</p>
        <div className="triple">
          <div>
            <b>{entries.length}</b>
            <small className="muted">Trades</small>
          </div>
          <div>
            <b className="ok">{wins}</b>
            <small className="muted">Gewinn</small>
          </div>
          <div>
            <b className="bad">{losses}</b>
            <small className="muted">Verlust</small>
          </div>
        </div>
        {goal !== undefined && (
          <div className="burn-goal">
            <div className="burn-top">
              <span className="muted">Tagesziel</span>
              <b>
                {eur(pnl)} / {eur(goal)}
              </b>
            </div>
            <MarkerBar value={Math.max(0, pnl)} target={goal} />
          </div>
        )}
      </section>

      <section className="card">
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { id: 'win', label: 'Gewinn' },
            { id: 'loss', label: 'Verlust' },
          ]}
        />
        <div className="duration spaced">
          <label className="field">
            <span className="muted">Betrag (€)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={amount}
              placeholder="0,00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="muted">Titel (optional)</span>
            <input
              type="text"
              value={label}
              placeholder="z. B. DAX Long"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span className="muted">Kommentar (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Attach ownerId={draft} />
        <button className="cta spaced" disabled={!valid} onClick={add}>
          {kind === 'win' ? 'Gewinn eintragen' : 'Verlust eintragen'}
        </button>
      </section>

      {entries.length > 0 && (
        <section className="card tight">
          <p className="muted">Trades · {entries.length}</p>
          <ul className="erows">
            {[...entries].reverse().map((e) => (
              <li key={e.id}>
                <button className="erow" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                  <span className={`kdot ${e.amount >= 0 ? 'activity' : 'food'}`}>
                    {e.amount >= 0 ? '+' : '−'}
                  </span>
                  <span className="emain">
                    <b>{e.label ?? 'Trade'}</b>
                    {e.note && <small className="clamp">{e.note}</small>}
                  </span>
                  <span className="emeta">
                    <PhotoBadge ownerId={e.id} />
                    <b className={tone(e.amount)}>{signed(e.amount)}</b>
                  </span>
                </button>
                {openId === e.id && (
                  <TradeEditor
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

function TradeEditor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: TradeEntry
  onSave: (e: TradeEntry) => void
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
            if (confirm('Trade löschen?')) {
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

function monthKeys() {
  const now = new Date()
  const n = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1)))
}

function History({ data, goals }: { data: AppData; goals: Goal[] }) {
  const [range, setRange] = useState<'woche' | 'monat'>('woche')
  const today = todayKey()
  const days = range === 'woche' ? weekKeys() : monthKeys()
  const byDay = new Map<string, number>()
  for (const e of data.trades) byDay.set(dayOf(e), (byDay.get(dayOf(e)) ?? 0) + e.amount)

  const goal = goals.find((g) => g.metric === 'pnl' && g.period === 'day')?.target
  const label = (k: string, i: number) =>
    range === 'woche' ? ['M', 'D', 'M', 'D', 'F', 'S', 'S'][i] : String(new Date(`${k}T12:00:00`).getDate())

  const all = data.trades
  const total = sum(all.map((e) => e.amount))
  const wins = all.filter((e) => e.amount > 0)
  const losses = all.filter((e) => e.amount < 0)
  const rate = all.length ? Math.round((wins.length / all.length) * 100) : null
  const avgWin = wins.length ? sum(wins.map((e) => e.amount)) / wins.length : 0
  const avgLoss = losses.length ? sum(losses.map((e) => e.amount)) / losses.length : 0
  const monthPrefix = today.slice(0, 7)
  const month = sum([...byDay].filter(([k]) => k.startsWith(monthPrefix)).map(([, v]) => v))
  const week = sum(weekKeys().map((k) => byDay.get(k) ?? 0))

  const dayList = [...byDay.keys()].sort()
  let run = 0
  const cum = dayList.map((k) => (run += byDay.get(k) ?? 0))
  const listDays = [...dayList].reverse().slice(0, 40)
  const shortDay = (k: string) =>
    new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
  const tradesPerDay = (k: string) => all.filter((e) => dayOf(e) === k).length

  return (
    <>
      <div className="stats">
        <Stat label="Gesamt" value={all.length ? signed(total) : '–'} />
        <Stat label="Monat" value={all.length ? signed(month) : '–'} />
        <Stat label="Woche" value={all.length ? signed(week) : '–'} />
      </div>
      <div className="stats">
        <Stat label="Trefferquote" value={rate === null ? '–' : `${rate} %`} />
        <Stat label="Ø Gewinn" value={wins.length ? eur(avgWin) : '–'} />
        <Stat label="Ø Verlust" value={losses.length ? eur(Math.abs(avgLoss)) : '–'} />
      </div>

      <section className="card">
        <p className="muted">Kontostand-Verlauf (kumuliert)</p>
        {cum.length === 0 ? (
          <p className="hint">Noch keine Trades.</p>
        ) : (
          <CumLine values={cum} labels={[shortDate(dayList[0]), shortDate(dayList[dayList.length - 1])]} />
        )}
      </section>

      <Seg
        value={range}
        onChange={setRange}
        options={[
          { id: 'woche', label: 'Woche' },
          { id: 'monat', label: 'Monat' },
        ]}
      />
      <section className="card">
        <p className="muted">Ergebnis pro Tag</p>
        <TargetBars
          signed
          data={days.map((k, i) => ({ key: k, value: Math.round(byDay.get(k) ?? 0), label: label(k, i) }))}
          target={goal}
        />
        {goal === undefined && (
          <p className="hint">Setze unter „Ziele“ ein Tagesziel, dann erscheint die Markierung.</p>
        )}
      </section>

      <section className="card tight">
        <p className="muted">Tage</p>
        {listDays.length === 0 && <p className="hint">Noch keine Einträge.</p>}
        <ul className="erows">
          {listDays.map((k) => (
            <li key={k}>
              <div className="erow static">
                <span className="emain">
                  <b>{shortDay(k)}</b>
                  <small>{tradesPerDay(k)} Trades</small>
                </span>
                <span className="emeta">
                  <b className={tone(byDay.get(k) ?? 0)}>{signed(byDay.get(k) ?? 0)}</b>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
