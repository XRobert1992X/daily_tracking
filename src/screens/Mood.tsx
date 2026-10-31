import { useState } from 'react'
import { LineChart } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { dailyMood, dayKey, lastDays, shortDate, sum } from '../stats'
import type { Goal, MoodEntry } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: MoodEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const MOODS = ['😞', '🙁', '😐', '🙂', '😄']
const MOOD_WORDS = ['schlecht', 'mäßig', 'okay', 'gut', 'super']
const ENERGY_WORDS = ['leer', 'müde', 'normal', 'fit', 'voller Energie']

export default function Mood(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'neu' | 'verlauf' | 'ziele'>('neu')

  return (
    <main className="app">
      <Header title="Stimmung & Energie" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'neu', label: 'Check-in' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'neu' && <CheckIn data={data} onSave={props.onSave} onDelete={props.onDelete} />}
      {tab === 'verlauf' && <History data={data} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="mood"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function Scale({
  value,
  onChange,
  labels,
  words,
}: {
  value: number
  onChange: (n: number) => void
  labels: string[]
  words: string[]
}) {
  return (
    <>
      <div className="scale">
        {labels.map((l, i) => (
          <button key={i} className={value === i + 1 ? 'on' : ''} onClick={() => onChange(i + 1)}>
            {l}
          </button>
        ))}
      </div>
      <small className="muted scale-word">{value ? words[value - 1] : 'Bitte wählen'}</small>
    </>
  )
}

function CheckIn({
  data,
  onSave,
  onDelete,
}: {
  data: AppData
  onSave: (e: MoodEntry) => void
  onDelete: (id: string) => void
}) {
  const [mood, setMood] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [note, setNote] = useState('')
  const today = dayKey(new Date())
  const todays = data.moods.filter((e) => dayKey(new Date(e.at)) === today)

  return (
    <>
      <section className="card">
        <p className="muted">Wie fühlst du dich gerade?</p>
        <Scale value={mood} onChange={setMood} labels={MOODS} words={MOOD_WORDS} />
      </section>
      <section className="card">
        <p className="muted">Wie viel Energie hast du?</p>
        <Scale
          value={energy}
          onChange={setEnergy}
          labels={['1', '2', '3', '4', '5']}
          words={ENERGY_WORDS}
        />
      </section>
      <section className="card">
        <label className="field">
          <span className="muted">Notiz (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Was beschäftigt dich?"
          />
        </label>
      </section>

      <button
        className="cta"
        disabled={!mood || !energy}
        onClick={() => {
          onSave({
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            mood,
            energy,
            note: note.trim() || undefined,
          })
          setMood(0)
          setEnergy(0)
          setNote('')
        }}
      >
        Speichern
      </button>

      {todays.length > 0 && (
        <section className="card">
          <p className="muted">Heute</p>
          <ul className="list">
            {[...todays].reverse().map((e) => (
              <li key={e.id}>
                <div>
                  <b>
                    {MOODS[e.mood - 1]} Stimmung {e.mood} · Energie {e.energy}
                  </b>
                  <small className="muted">
                    {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {e.note && ` · ${e.note}`}
                  </small>
                </div>
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Eintrag löschen?') && onDelete(e.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function History({ data }: { data: AppData }) {
  const daily = dailyMood(data.moods)
  const days = lastDays(30)
  const avg = (key: 'mood' | 'energy', n: number) => {
    const vals = lastDays(n)
      .map((k) => daily.get(k)?.[key])
      .filter((v): v is number => v !== undefined)
    return vals.length ? (sum(vals) / vals.length).toFixed(1) : '–'
  }

  const activities = [
    {
      label: 'Meditationstagen',
      days: new Set(data.meditation.map((s) => dayKey(new Date(s.startedAt)))),
    },
    { label: 'Lesetagen', days: new Set(data.readingLogs.map((l) => l.day)) },
    { label: 'Fokus-Tagen', days: new Set(data.focus.map((s) => dayKey(new Date(s.startedAt)))) },
    {
      label: 'Tagen mit sozialer Interaktion',
      days: new Set(data.social.map((e) => dayKey(new Date(e.at)))),
    },
  ]

  const insights = activities
    .map((a) => {
      const withAct: { mood: number; energy: number }[] = []
      const without: { mood: number; energy: number }[] = []
      for (const [k, v] of daily) (a.days.has(k) ? withAct : without).push(v)
      if (withAct.length < 3 || without.length < 3) return null
      const m = (list: typeof withAct, key: 'mood' | 'energy') => sum(list.map((x) => x[key])) / list.length
      return {
        label: a.label,
        mood: m(withAct, 'mood') - m(without, 'mood'),
        energy: m(withAct, 'energy') - m(without, 'energy'),
        n: withAct.length,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const sign = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`

  return (
    <>
      <div className="stats">
        <Stat label="Check-ins" value={String(data.moods.length)} />
        <Stat label="Ø Stimmung 7T" value={avg('mood', 7)} />
        <Stat label="Ø Energie 7T" value={avg('energy', 7)} />
      </div>

      <section className="card">
        <p className="muted">Letzte 30 Tage</p>
        {daily.size === 0 ? (
          <p className="hint">Noch keine Check-ins.</p>
        ) : (
          <LineChart
            labels={days.map(shortDate)}
            series={[
              { name: 'Stimmung', color: '#a78bfa', values: days.map((k) => daily.get(k)?.mood ?? null) },
              { name: 'Energie', color: '#22d3ee', values: days.map((k) => daily.get(k)?.energy ?? null) },
            ]}
          />
        )}
      </section>

      <section className="card">
        <p className="muted">Zusammenhänge</p>
        {insights.length === 0 ? (
          <p className="hint">
            Sobald du an mindestens 3 Tagen mit und 3 Tagen ohne Meditation, Lesen oder Fokus
            eingecheckt hast, zeigt die App hier Unterschiede.
          </p>
        ) : (
          <ul className="list">
            {insights.map((i) => (
              <li key={i.label}>
                <div>
                  <b>An {i.label}</b>
                  <small className="muted">
                    Stimmung{' '}
                    <span className={i.mood >= 0 ? 'ok' : 'bad'}>{sign(i.mood)}</span> · Energie{' '}
                    <span className={i.energy >= 0 ? 'ok' : 'bad'}>{sign(i.energy)}</span> (
                    {i.n} Tage)
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Das zeigt eine Korrelation und keinen Beweis für eine Ursache.</p>
      </section>

      <section className="card">
        <p className="muted">Letzte Einträge</p>
        <ul className="list">
          {[...data.moods]
            .reverse()
            .slice(0, 15)
            .map((e) => (
              <li key={e.id}>
                <div>
                  <b>
                    {MOODS[e.mood - 1]} {e.mood} · ⚡ {e.energy}
                  </b>
                  <small className="muted">
                    {new Date(e.at).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {e.note && ` · ${e.note}`}
                  </small>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}
