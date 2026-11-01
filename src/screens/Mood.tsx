import { useState } from 'react'
import { Attach, PhotoBadge } from '../components/Attach'
import { LineChart } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { Header, Meter, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import { bucketOf, bucketStats, BUCKETS, dailyMood, dayKey, energy10, lastDays, mood10, shortDate, sum } from '../stats'
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

const MOOD_WORDS = [
  'sehr schlecht',
  'schlecht',
  'niedergeschlagen',
  'mäßig',
  'okay',
  'ganz gut',
  'gut',
  'sehr gut',
  'großartig',
  'ausgezeichnet',
]
const ENERGY_WORDS = [
  'leer',
  'sehr müde',
  'müde',
  'matt',
  'okay',
  'normal',
  'wach',
  'fit',
  'energiegeladen',
  'voller Energie',
]

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
  max,
  words,
}: {
  value: number
  onChange: (n: number) => void
  max: number
  words: string[]
}) {
  return (
    <div className="scale-wrap">
      <Meter value={value} max={max} onChange={onChange} />
      <div className="scale-read">
        <b>
          {value || '–'}
          <small>/{max}</small>
        </b>
        <small className="muted">{value ? words[value - 1] : 'Bitte wählen'}</small>
      </div>
    </div>
  )
}

function bucketLabel(iso: string) {
  const b = BUCKETS[bucketOf(iso)]
  return `${b.label} Uhr`
}

function entryTitle(e: MoodEntry) {
  return `Stimmung ${mood10(e)}/10 · Energie ${energy10(e)}/10`
}

function entryNotes(e: MoodEntry) {
  return [e.moodNote && `Stimmung: ${e.moodNote}`, e.energyNote && `Energie: ${e.energyNote}`, e.note]
    .filter(Boolean)
    .join(' · ')
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
  const [moodNote, setMoodNote] = useState('')
  const [energyNote, setEnergyNote] = useState('')
  // Leer = jetzt; sonst Uhrzeit von heute (für nachgetragene Einträge)
  const [time, setTime] = useState('')
  const [draft, setDraft] = useState(() => crypto.randomUUID())
  const today = dayKey(new Date())
  const todays = data.moods.filter((e) => dayKey(new Date(e.at)) === today)

  const atIso = () => {
    if (!time) return new Date().toISOString()
    const [h, m] = time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return (d > new Date() ? new Date() : d).toISOString()
  }
  const previewBucket = bucketLabel(atIso())

  return (
    <>
      <section className="card">
        <p className="muted">Wie fühlst du dich gerade?</p>
        <Scale value={mood} onChange={setMood} max={10} words={MOOD_WORDS} />
        <label className="field">
          <span className="muted">Notiz zur Stimmung (optional)</span>
          <textarea
            rows={2}
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            placeholder="Woran liegt das?"
          />
        </label>
      </section>
      <section className="card">
        <p className="muted">Wie viel Energie hast du?</p>
        <Scale value={energy} onChange={setEnergy} max={10} words={ENERGY_WORDS} />
        <label className="field">
          <span className="muted">Notiz zur Energie (optional)</span>
          <textarea
            rows={2}
            value={energyNote}
            onChange={(e) => setEnergyNote(e.target.value)}
            placeholder="Schlaf, Essen, Training …"
          />
        </label>
      </section>
      <section className="card">
        <div className="timerow">
          <label className="field">
            <span className="muted">Uhrzeit (leer = jetzt)</span>
            <input
              type="time"
              value={time}
              max={new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <span className="pill">{previewBucket}</span>
        </div>
        <Attach ownerId={draft} />
      </section>

      <button
        className="cta"
        disabled={!mood || !energy}
        onClick={() => {
          onSave({
            id: draft,
            at: atIso(),
            mood,
            moodScale: 10,
            energy,
            energyScale: 10,
            moodNote: moodNote.trim() || undefined,
            energyNote: energyNote.trim() || undefined,
          })
          setMood(0)
          setEnergy(0)
          setMoodNote('')
          setEnergyNote('')
          setTime('')
          setDraft(crypto.randomUUID())
        }}
      >
        Speichern
      </button>

      {todays.length > 0 && (
        <section className="card">
          <p className="muted">Heute</p>
          <ul className="list">
            {[...todays]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((e) => (
                <li key={e.id}>
                  <div>
                    <b>{entryTitle(e)}</b>
                    <small className="muted">
                      {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {bucketLabel(e.at)}
                      {entryNotes(e) && ` · ${entryNotes(e)}`}
                    </small>
                  </div>
                  <PhotoBadge ownerId={e.id} />
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
  const buckets = bucketStats(data.moods)
  const filled = buckets.filter((b) => b.n > 0)
  // Fenster mit nur einem Eintrag zählen erst, wenn es keine besseren Daten gibt
  const pool = filled.some((b) => b.n >= 2) ? filled.filter((b) => b.n >= 2) : filled
  const best = (key: 'mood' | 'energy') =>
    pool.length ? pool.reduce((a, b) => ((b[key] ?? 0) > (a[key] ?? 0) ? b : a)) : null
  const bestEnergy = best('energy')
  const bestMood = best('mood')
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
            max={10}
            labels={days.map(shortDate)}
            series={[
              {
                name: 'Stimmung',
                color: '#e4e4e7',
                values: days.map((k) => daily.get(k)?.mood ?? null),
              },
              { name: 'Energie', color: '#38bdf8', values: days.map((k) => daily.get(k)?.energy ?? null) },
            ]}
          />
        )}
        <p className="hint">Skala 1–10. Ältere Einträge (1–5) sind dafür verdoppelt.</p>
      </section>

      <section className="card">
        <p className="muted">Tageszeiten (3-Stunden-Fenster)</p>
        {buckets.every((b) => b.n === 0) ? (
          <p className="hint">Noch keine Check-ins.</p>
        ) : (
          <>
            <div className="bkts">
              {buckets
                .filter((b) => b.n > 0)
                .map((b) => (
                  <div key={b.index} className="bkt">
                    <span className="bkt-label">{b.label}</span>
                    <div className="bkt-bars">
                      <div className="bkt-bar mood" style={{ width: `${((b.mood ?? 0) / 10) * 100}%` }} />
                      <div className="bkt-bar energy" style={{ width: `${((b.energy ?? 0) / 10) * 100}%` }} />
                    </div>
                    <span className="bkt-val">
                      {(b.mood ?? 0).toFixed(1)} · {(b.energy ?? 0).toFixed(1)}
                      <small className="muted"> ({b.n}×)</small>
                    </span>
                  </div>
                ))}
            </div>
            <div className="legend">
              <span>
                <i style={{ background: '#e4e4e7' }} /> Stimmung
              </span>
              <span>
                <i style={{ background: '#38bdf8' }} /> Energie
              </span>
            </div>
            {bestEnergy && bestMood && (
              <p className="hint">
                Beste Energie: {bestEnergy.label} Uhr ({(bestEnergy.energy ?? 0).toFixed(1)}) · Beste
                Stimmung: {bestMood.label} Uhr ({(bestMood.mood ?? 0).toFixed(1)}). Fenster mit mehr als
                einem Eintrag werden bevorzugt.
              </p>
            )}
          </>
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
                  <b>{entryTitle(e)}</b>
                  <small className="muted">
                    {new Date(e.at).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {new Date(e.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {bucketLabel(e.at)}
                    {entryNotes(e) && ` · ${entryNotes(e)}`}
                  </small>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}
