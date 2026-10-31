import { useRef, useState } from 'react'
import { parseBackup, exportBackup } from '../storage'
import { avgRate, dayKey, ratePer10, streak, totalMinutes, trend } from '../stats'
import {
  DEFAULT_MINUTES,
  DEFAULT_TYPE,
  MEDITATION_TYPES,
  MINUTE_OPTIONS,
  typeLabel,
} from '../types'
import type { MeditationSession } from '../types'

export interface Preset {
  type: string
  plannedMin: number
}

interface Props {
  sessions: MeditationSession[]
  onBack: () => void
  onStart: (p: Preset) => void
  onDelete: (id: string) => void
  onImport: (list: MeditationSession[]) => number
}

export default function Meditation({
  sessions,
  onBack,
  onStart,
  onDelete,
  onImport,
}: Props) {
  const [tab, setTab] = useState<'start' | 'verlauf'>('start')
  return (
    <main className="app">
      <header className="header">
        <button className="back" onClick={onBack} aria-label="Zurück">
          ‹
        </button>
        <h1>Meditation</h1>
        <span style={{ width: 36 }} />
      </header>

      <div className="seg">
        <button className={tab === 'start' ? 'on' : ''} onClick={() => setTab('start')}>
          Start
        </button>
        <button className={tab === 'verlauf' ? 'on' : ''} onClick={() => setTab('verlauf')}>
          Verlauf
        </button>
      </div>

      {tab === 'start' ? (
        <Setup onStart={onStart} />
      ) : (
        <History
          sessions={sessions}
          onDelete={onDelete}
          onImport={onImport}
        />
      )}
    </main>
  )
}

function Setup({ onStart }: { onStart: (p: Preset) => void }) {
  const [type, setType] = useState(DEFAULT_TYPE)
  const [text, setText] = useState(String(DEFAULT_MINUTES))

  const parsed = parseInt(text, 10)
  const valid = parsed >= 1 && parsed <= 240
  const minutes = valid ? parsed : 0
  // Dropdown zeigt den Standardwert nur, wenn die Eingabe genau dazu passt
  const selected = MINUTE_OPTIONS.includes(parsed) && String(parsed) === text ? text : ''

  return (
    <>
      <section className="card">
        <label className="field">
          <span className="muted">Art der Meditation</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {MEDITATION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="muted">Dauer in Minuten</span>
          <div className="duration">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              placeholder="Min"
              aria-label="Minuten eingeben"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <select
              aria-label="Standarddauer wählen"
              value={selected}
              onChange={(e) => setText(e.target.value)}
            >
              <option value="" disabled>
                Auswählen…
              </option>
              {MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} Minuten
                </option>
              ))}
            </select>
          </div>
          {text !== '' && !valid && <small className="bad">Bitte 1 bis 240 Minuten eingeben</small>}
        </div>
      </section>

      <button
        className="cta"
        disabled={!valid}
        onClick={() => onStart({ type, plannedMin: minutes })}
      >
        {valid ? `▶ ${minutes} Min starten` : '▶ Starten'}
      </button>
    </>
  )
}

function History({
  sessions,
  onDelete,
  onImport,
}: {
  sessions: MeditationSession[]
  onDelete: (id: string) => void
  onImport: (list: MeditationSession[]) => number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const t = trend(sessions)
  const better = t.recent !== null && t.previous !== null && t.recent < t.previous
  const worse = t.recent !== null && t.previous !== null && t.recent > t.previous

  return (
    <>
      <div className="stats">
        <Stat label="Sitzungen" value={String(sessions.length)} />
        <Stat label="Serie (Tage)" value={String(streak(sessions))} />
        <Stat label="Minuten" value={String(totalMinutes(sessions))} />
      </div>

      <section className="card">
        <p className="muted">Unterbrechungen pro Sitzung</p>
        {sessions.length === 0 ? (
          <p className="hint">Noch keine Sitzungen. Starte deine erste Meditation.</p>
        ) : (
          <>
            <Chart sessions={sessions} />
            <p className="trend">
              <b>{t.recent === null ? '–' : t.recent.toFixed(1)}</b>
              <span className="muted"> pro 10 Min (letzte 5)</span>
              {t.previous !== null && (
                <span className={better ? 'ok' : worse ? 'bad' : 'muted'}>
                  {' '}
                  {better ? '▼ besser' : worse ? '▲ mehr' : '= gleich'} (vorher{' '}
                  {t.previous.toFixed(1)})
                </span>
              )}
            </p>
          </>
        )}
      </section>

      <section className="card">
        <p className="muted">Letzte 5 Wochen</p>
        <Heatmap sessions={sessions} />
      </section>

      <section className="card">
        <p className="muted">Alle Sitzungen</p>
        <ul className="list">
          {[...sessions].reverse().map((s) => {
            const d = new Date(s.startedAt)
            const r = ratePer10(s)
            return (
              <li key={s.id}>
                <div>
                  <b>{typeLabel(s.type)}</b>
                  <small className="muted">
                    {d.toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {Math.round(s.actualSec / 60)}/{s.plannedMin} Min
                    {r !== null && ` · ${r.toFixed(1)}/10 Min`}
                  </small>
                </div>
                <span className="chip">{s.interruptions}×</span>
                <button
                  className="x"
                  aria-label="Löschen"
                  onClick={() => confirm('Sitzung löschen?') && onDelete(s.id)}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
        {avgRate(sessions) !== null && (
          <p className="hint">Ø {avgRate(sessions)!.toFixed(1)} Unterbrechungen pro 10 Min</p>
        )}
      </section>

      <section className="card">
        <p className="muted">Backup</p>
        <div className="row">
          <button className="ghost" onClick={() => void exportBackup(sessions)}>
            Exportieren
          </button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            Importieren
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const added = onImport(await parseBackup(f))
              setMsg(`${added} Sitzungen importiert`)
            } catch {
              setMsg('Datei konnte nicht gelesen werden')
            }
          }}
        />
        {msg && <p className="hint">{msg}</p>}
        <p className="hint">
          Die Daten liegen nur auf diesem Gerät. Exportiere regelmäßig ein Backup.
        </p>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <b>{value}</b>
      <small className="muted">{label}</small>
    </div>
  )
}

function Chart({ sessions }: { sessions: MeditationSession[] }) {
  const data = sessions.slice(-20)
  const W = 320
  const H = 140
  const pad = 20
  const max = Math.max(5, ...data.map((s) => s.interruptions))
  const bw = (W - pad * 2) / data.length
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const x = (i: number) => pad + i * bw + bw / 2

  // gleitender Durchschnitt über 3 Sitzungen als Trendlinie
  const avg = data.map((_, i) => {
    const w = data.slice(Math.max(0, i - 2), i + 1)
    return w.reduce((a, s) => a + s.interruptions, 0) / w.length
  })
  const fmt = (s: MeditationSession) =>
    new Date(s.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
      {data.map((s, i) => (
        <g key={s.id}>
          <rect
            x={pad + i * bw + bw * 0.15}
            width={bw * 0.7}
            y={y(s.interruptions)}
            height={H - pad - y(s.interruptions)}
            rx={3}
            fill="url(#bar)"
          />
          {data.length <= 12 && (
            <text x={x(i)} y={y(s.interruptions) - 4} className="val">
              {s.interruptions}
            </text>
          )}
        </g>
      ))}
      <polyline
        points={avg.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        className="trendline"
      />
      <text x={pad} y={H - 4} className="lbl">
        {fmt(data[0])}
      </text>
      <text x={W - pad} y={H - 4} className="lbl end">
        {fmt(data[data.length - 1])}
      </text>
    </svg>
  )
}

function Heatmap({ sessions }: { sessions: MeditationSession[] }) {
  const minutes = new Map<string, number>()
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt))
    minutes.set(k, (minutes.get(k) ?? 0) + s.actualSec / 60)
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const mondayOffset = (today.getDay() + 6) % 7
  const start = new Date(today)
  start.setDate(today.getDate() - mondayOffset - 28)

  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const m = minutes.get(dayKey(d)) ?? 0
    return { key: dayKey(d), m, future: d > today, today: d.getTime() === today.getTime() }
  })

  return (
    <>
      <div className="heat head">
        {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((l, i) => (
          <small key={i} className="muted">
            {l}
          </small>
        ))}
      </div>
      <div className="heat">
        {cells.map((c) => (
          <span
            key={c.key}
            title={`${c.key}: ${Math.round(c.m)} Min`}
            className={`cell ${c.future ? 'future' : ''} ${c.today ? 'today' : ''} l${
              c.m === 0 ? 0 : c.m < 10 ? 1 : c.m < 20 ? 2 : 3
            }`}
          />
        ))}
      </div>
    </>
  )
}
