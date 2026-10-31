import { useState } from 'react'

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
    <div className="seg" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
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
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
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

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  return [on, () => setOn((v) => !v), setOn] as const
}
