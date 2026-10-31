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
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0.7" />
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

const fmtShort = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(v))

// Balken pro Tag, die bis zur Zielmarkierung (gestrichelte Linie) wachsen; Treffer werden grün
export function TargetBars({
  data,
  target,
  signed,
}: {
  data: { key: string; value: number; label: string }[]
  target?: number
  signed?: boolean
}) {
  const W = 320
  const H = 180
  const top = 20
  const bottom = H - 24
  const vals = data.map((d) => d.value)
  const maxV = Math.max(target ?? 0, ...vals, 1)
  const minV = signed ? Math.min(0, ...vals) : 0
  const range = maxV - minV || 1
  const y = (v: number) => top + ((maxV - v) / range) * (bottom - top)
  const zeroY = y(0)
  const bw = (W - 16) / Math.max(1, data.length)
  const labelStep = Math.ceil(data.length / 8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs>
        <linearGradient id="tb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <line x1={8} x2={W - 8} y1={zeroY} y2={zeroY} className="axis" />
      {data.map((d, i) => {
        const x = 8 + i * bw
        const hit = target !== undefined && d.value >= target
        const fill = d.value < 0 ? '#fb923c' : hit || signed ? '#34d399' : 'url(#tb)'
        const yv = y(d.value)
        return (
          <g key={d.key}>
            {d.value !== 0 && (
              <rect
                x={x + bw * 0.15}
                width={bw * 0.7}
                y={Math.min(yv, zeroY)}
                height={Math.abs(zeroY - yv)}
                rx={3}
                fill={fill}
              />
            )}
            {data.length <= 8 && d.value !== 0 && (
              <text
                x={x + bw / 2}
                y={d.value < 0 ? yv + 11 : yv - 4}
                className="val"
              >
                {fmtShort(d.value)}
              </text>
            )}
            {i % labelStep === 0 && (
              <text x={x + bw / 2} y={H - 8} className="lbl mid">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
      {target !== undefined && (
        <g>
          <line x1={8} x2={W - 8} y1={y(target)} y2={y(target)} className="target-line" />
          <text x={W - 8} y={y(target) - 4} className="lbl end target-lbl">
            Ziel {fmtShort(target)}
          </text>
        </g>
      )}
    </svg>
  )
}

// Kumulierte Kurve (z. B. Gewinn/Verlust über die Zeit)
export function CumLine({ values, labels }: { values: number[]; labels: [string, string] }) {
  const W = 320
  const H = 150
  const pad = 16
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values, 1)
  const range = hi - lo || 1
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1)
  const y = (v: number) => pad + ((hi - v) / range) * (H - pad * 2 - 6)
  const last = values[values.length - 1] ?? 0
  const color = last >= 0 ? '#34d399' : '#fb923c'
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="axis" />
      {values.length > 1 && (
        <polygon points={`${x(0)},${y(0)} ${pts} ${x(values.length - 1)},${y(0)}`} fill={color} opacity="0.12" />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.200} strokeLinejoin="round" />
      {values.length > 0 && <circle cx={x(values.length - 1)} cy={y(last)} r={3.500} fill={color} />}
      <text x={pad} y={H - 4} className="lbl">
        {labels[0]}
      </text>
      <text x={W - pad} y={H - 4} className="lbl end">
        {labels[1]}
      </text>
    </svg>
  )
}
