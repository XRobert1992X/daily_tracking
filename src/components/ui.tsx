import { useState } from 'react'
import { addDays, dayKey, todayKey } from '../stats'

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="header">
      <button className="back" onClick={onBack} aria-label="Zurück">
        ‹
      </button>
      <h1>{title}</h1>
      <span style={{ width: 36 }} />
    </header>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      className={`seg ${options.length >= 5 ? 'many' : ''}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  small,
}: {
  value: number
  onChange: (n: number) => void
  small?: boolean
}) {
  return (
    <div className={`stepper ${small ? 'small' : ''}`}>
      <button onClick={() => onChange(Math.max(0, value - 1))} aria-label="Weniger">
        −
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="Mehr">
        +
      </button>
    </div>
  )
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="bar">
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <b>{value}</b>
      <small className="muted">{label}</small>
    </div>
  )
}

// Zahlenfeld zum direkten Eintippen plus Dropdown mit Standardwerten
export function DurationPicker({
  label,
  text,
  onText,
  options,
  max = 240,
}: {
  label: string
  text: string
  onText: (t: string) => void
  options: number[]
  max?: number
}) {
  const parsed = parseInt(text, 10)
  const valid = parsed >= 1 && parsed <= max
  const selected = options.includes(parsed) && String(parsed) === text ? text : ''
  return (
    <div className="field">
      <span className="muted">{label}</span>
      <div className="duration">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          placeholder="Min"
          aria-label={`${label} eingeben`}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <select
          aria-label={`${label} wählen`}
          value={selected}
          onChange={(e) => onText(e.target.value)}
        >
          <option value="" disabled>
            Auswählen…
          </option>
          {options.map((m) => (
            <option key={m} value={m}>
              {m} Minuten
            </option>
          ))}
        </select>
      </div>
      {text !== '' && !valid && <small className="bad">Bitte 1 bis {max} eingeben</small>}
    </div>
  )
}

export function parseMinutes(text: string, max = 240) {
  const n = parseInt(text, 10)
  return n >= 1 && n <= max ? n : 0
}

// Fortschrittsbalken mit Zielmarkierung
export function MarkerBar({ value, target }: { value: number; target: number }) {
  const max = Math.max(value, target) * 1.15 || 1
  return (
    <div className="mbar">
      <i
        className={value >= target ? 'hit' : ''}
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
      <span className="mark" style={{ left: `${(target / max) * 100}%` }} />
    </div>
  )
}

// Pegelanzeige: Balken in aufsteigender Höhe zum Antippen (nochmal tippen = löschen)
export function Meter({
  value,
  max,
  onChange,
  compact,
}: {
  value: number
  max: number
  onChange: (n: number) => void
  compact?: boolean
}) {
  return (
    <div className={`meter ${compact ? 'compact' : ''}`} role="group">
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1
        const h = (compact ? 18 : 22) + (i / Math.max(1, max - 1)) * (compact ? 16 : 30)
        return (
          <button
            key={n}
            className={`mb ${n <= value ? 'on' : ''} ${n === value ? 'cur' : ''}`}
            style={{ height: h }}
            aria-label={`${n} von ${max}`}
            onClick={() => onChange(value === n ? 0 : n)}
          />
        )
      })}
    </div>
  )
}

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  return [on, () => setOn((v) => !v), setOn] as const
}

// Tageswechsler: ‹ Heute ›
export function DayNav({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  const today = todayKey()
  const shift = (n: number) => onChange(dayKey(addDays(new Date(`${day}T12:00:00`), n)))
  const label =
    day === today
      ? 'Heute'
      : day === dayKey(addDays(new Date(), -1))
        ? 'Gestern'
        : new Date(`${day}T12:00:00`).toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          })
  return (
    <div className="daynav">
      <button onClick={() => shift(-1)} aria-label="Vorheriger Tag">
        ‹
      </button>
      <b>{label}</b>
      <button onClick={() => shift(1)} disabled={day >= today} aria-label="Nächster Tag">
        ›
      </button>
    </div>
  )
}

// Kleiner Fortschrittsring für Zähl-ToDos: Zahl in der Mitte, bei Erreichen grün mit Haken
export function MiniRing({ value, max, done }: { value: number; max: number; done?: boolean }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className={`miniring ${done ? 'done' : ''}`} aria-label={`${value} von ${max}`}>
      <svg viewBox="0 0 38 38" width={42} height={42}>
        <circle cx="19" cy="19" r={r} className="mr-bg" />
        <circle
          cx="19"
          cy="19"
          r={r}
          className="mr-fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value / max))}
        />
      </svg>
      <span>{done ? '✓' : value}</span>
      {!done && <small>/{max}</small>}
    </div>
  )
}

// Ring mit Zahl in der Mitte
export function Ring({
  done,
  total,
  size = 92,
  label,
}: {
  done: number
  total: number
  size?: number
  label?: string
}) {
  const r = 38
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  return (
    <div className="ring2" style={{ width: size, height: size }}>
      <svg viewBox="0 0 92 92" width={size} height={size}>
        <defs>
          <linearGradient id="ring2g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="46" cy="46" r={r} className="ring2-bg" />
        <circle
          cx="46"
          cy="46"
          r={r}
          className={`ring2-fg ${total > 0 && done >= total ? 'full' : ''}`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="ring2-text">
        <b>{done}</b>
        <small>/ {total}</small>
        {label && <span className="sr-only">{label}</span>}
      </div>
    </div>
  )
}

// Eine Markierung pro Wochentag (Mo–So), gefüllt wenn der Tageswert erreicht ist
export function WeekDots({ days }: { days: { hit: boolean; future: boolean; today: boolean }[] }) {
  return (
    <div className="wdots">
      {days.map((d, i) => (
        <div key={i} className={`wdot ${d.hit ? 'hit' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}`}>
          <span>{d.hit ? '✓' : ''}</span>
          <small>{['M', 'D', 'M', 'D', 'F', 'S', 'S'][i]}</small>
        </div>
      ))}
    </div>
  )
}
