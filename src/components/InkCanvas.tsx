import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Stroke } from '../types'

// Alle Koordinaten liegen in einer logischen Breite von 1000, damit die Zeichnung auf jeder Bildschirmgröße gleich aussieht
export const INK_W = 1000

export interface InkSettings {
  tool: 'pen' | 'marker' | 'eraser'
  color: string
  // Stift/Marker: Strichstärke, Radierer: Radiergröße (in logischen Einheiten)
  width: number
  // Radierer: pixel = Teile wegradieren, stroke = ganze Striche löschen
  eraserMode: 'pixel' | 'stroke'
  // Standard: nur Stift (und Maus) zeichnen, der Finger scrollt
  finger: boolean
}

interface Props {
  strokes: Stroke[]
  h: number
  settings: InkSettings
  readOnly?: boolean
  onChange?: (s: Stroke[]) => void
}

function paint(ctx: CanvasRenderingContext2D, st: Stroke, s: number) {
  const p = st.pts
  if (st.tool === 'eraser') {
    // Pixel-Radierer: löscht, was frühere Striche gezeichnet haben
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#000'
    ctx.lineWidth = st.width * s
    if (p.length === 3) {
      ctx.beginPath()
      ctx.arc(p[0] * s, p[1] * s, (st.width * s) / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      for (let i = 3; i < p.length; i += 3) {
        ctx.beginPath()
        ctx.moveTo(p[i - 3] * s, p[i - 2] * s)
        ctx.lineTo(p[i] * s, p[i + 1] * s)
        ctx.stroke()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    return
  }
  ctx.strokeStyle = st.color
  ctx.fillStyle = st.color
  ctx.globalAlpha = st.tool === 'marker' ? 0.35 : 1
  const base = st.width * (st.tool === 'marker' ? 4 : 1) * s
  if (p.length === 3) {
    ctx.beginPath()
    ctx.arc(p[0] * s, p[1] * s, base * (st.tool === 'marker' ? 0.5 : 0.5 + p[2] * 0.4), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let i = 3; i < p.length; i += 3) {
    ctx.beginPath()
    ctx.lineWidth = st.tool === 'marker' ? base : base * (0.45 + p[i + 2] * 0.9)
    ctx.moveTo(p[i - 3] * s, p[i - 2] * s)
    ctx.lineTo(p[i] * s, p[i + 1] * s)
    ctx.stroke()
  }
}

export default function InkCanvas({ strokes, h, settings, readOnly, onChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [local, setLocal] = useState(strokes)
  const localRef = useRef(local)
  localRef.current = local
  const live = useRef<Stroke | null>(null)
  const erased = useRef(false)
  const drawing = useRef(false)

  useEffect(() => setLocal(strokes), [strokes])

  const draw = useCallback(() => {
    const c = canvas.current
    if (!c || !c.clientWidth) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(c.clientWidth * dpr)
    const hh = Math.round(((c.clientWidth * h) / INK_W) * dpr)
    if (c.width !== w || c.height !== hh) {
      c.width = w
      c.height = hh
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const s = c.width / INK_W
    for (const st of localRef.current) paint(ctx, st, s)
    if (live.current) paint(ctx, live.current, s)
    ctx.globalAlpha = 1
  }, [h])

  useEffect(() => draw(), [local, draw])
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(el)
    return () => ro.disconnect()
  }, [draw])

  const point = (clientX: number, clientY: number, pressure: number, pen: boolean) => {
    const r = canvas.current!.getBoundingClientRect()
    return [
      ((clientX - r.left) / r.width) * INK_W,
      ((clientY - r.top) / r.height) * h,
      pen ? pressure || 0.5 : 0.5,
    ]
  }

  // Radierer: entfernt jeden Strich, den die Spitze berührt
  const eraseAt = (x: number, y: number) => {
    const R = 26
    const next = localRef.current.filter((st) => {
      for (let i = 0; i < st.pts.length; i += 3) {
        if (Math.hypot(st.pts[i] - x, st.pts[i + 1] - y) < R) return false
      }
      return true
    })
    if (next.length !== localRef.current.length) {
      erased.current = true
      localRef.current = next
      setLocal(next)
    }
  }

  const allowed = (e: ReactPointerEvent) => e.pointerType !== 'touch' || settings.finger

  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !allowed(e)) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // nicht jedes Eingabegerät unterstützt das Einfangen
    }
    drawing.current = true
    const [x, y, p] = point(e.clientX, e.clientY, e.pressure, e.pointerType === 'pen')
    if (settings.tool === 'eraser' && settings.eraserMode === 'stroke') eraseAt(x, y)
    else {
      live.current = { tool: settings.tool, color: settings.color, width: settings.width, pts: [x, y, p] }
      draw()
    }
  }

  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y, p] = point(ev.clientX, ev.clientY, ev.pressure, e.pointerType === 'pen')
      if (settings.tool === 'eraser' && settings.eraserMode === 'stroke') eraseAt(x, y)
      else live.current?.pts.push(x, y, p)
    }
    draw()
  }

  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    if (live.current && live.current.pts.length >= 3) {
      const next = [...localRef.current, live.current]
      localRef.current = next
      setLocal(next)
      onChange?.(next)
    } else if (erased.current) {
      onChange?.(localRef.current)
    }
    live.current = null
    erased.current = false
    draw()
  }

  return (
    <canvas
      ref={canvas}
      className={`ink-canvas ${settings.finger ? 'finger' : ''} ${readOnly ? 'ro' : ''}`}
      style={{ aspectRatio: `${INK_W} / ${h}` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  )
}
