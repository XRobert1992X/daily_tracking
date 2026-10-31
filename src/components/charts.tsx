import { addDays, dayKey } from '../stats'

interface Bar {
  key: string
  value: number
  label?: string
}

export function BarChart({ data, trend }: { data: Bar[]; trend?: boolean }) {
  const W = 320
  const H = 140
  const pad = 20
  const max = Math.max(5, ...data.map((d) => d.value))
  const bw = (W - pad * 2) / data.length
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const x = (i: number) => pad + i * bw + bw / 2
  const avg = data.map((_, i) => {
    const w = data.slice(Math.max(0, i - 2), i + 1)
    return w.reduce((a, d) => a + d.value, 0) / w.length
  })
  const first = data[0]?.label
  const last = data[data.length - 1]?.label

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
      {data.map((d, i) => (
        <g key={d.key}>
          {d.value > 0 && (
            <rect
              x={pad + i * bw + bw * 0.15}
              width={bw * 0.7}
              y={y(d.value)}
              height={H - pad - y(d.value)}
              rx={3}
              fill="url(#bar)"
            />
          )}
          {data.length <= 12 && d.value > 0 && (
            <text x={x(i)} y={y(d.value) - 4} className="val">
              {Math.round(d.value * 10) / 10}
            </text>
          )}
        </g>
      ))}
      {trend && data.length > 1 && (
        <polyline
          points={avg.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          className="trendline"
        />
      )}
      {first && (
        <text x={pad} y={H - 4} className="lbl">
          {first}
        </text>
      )}
      {last && (
        <text x={W - pad} y={H - 4} className="lbl end">
          {last}
        </text>
      )}
    </svg>
  )
}

export interface Series {
  name: string
  color: string
  values: (number | null)[]
}

// Skala 1–5, fehlende Tage unterbrechen die Linie nicht, sondern werden übersprungen
export function LineChart({
  labels,
  series,
}: {
  labels: string[]
  series: Series[]
}) {
  const W = 320
  const H = 150
  const pad = 22
  const n = labels.length
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1)
  const y = (v: number) => H - pad - ((v - 1) / 4) * (H - pad * 2)

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} className="axis" />
            <text x={pad - 6} y={y(v) + 3} className="lbl end">
              {v}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => (v === null ? null : ([x(i), y(v)] as const)))
            .filter((p): p is readonly [number, number] => p !== null)
          return (
            <g key={s.name}>
              <polyline
                points={pts.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={s.color} />
              ))}
            </g>
          )
        })}
        <text x={pad} y={H - 4} className="lbl">
          {labels[0]}
        </text>
        <text x={W - pad} y={H - 4} className="lbl end">
          {labels[n - 1]}
        </text>
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </>
  )
}

export function Heatmap({
  values,
  level,
  weeks = 5,
}: {
  values: Map<string, number>
  level: (v: number) => 0 | 1 | 2 | 3
  weeks?: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monday = addDays(today, -((today.getDay() + 6) % 7) - (weeks - 1) * 7)

  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(monday, i)
    const v = values.get(dayKey(d)) ?? 0
    return { key: dayKey(d), v, future: d > today, today: d.getTime() === today.getTime() }
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
            title={c.key}
            className={`cell ${c.future ? 'future' : ''} ${c.today ? 'today' : ''} l${level(c.v)}`}
          />
        ))}
      </div>
    </>
  )
}
