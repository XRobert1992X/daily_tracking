import { useState } from 'react'
import type { InkSettings } from './InkCanvas'

export type Tool = 'pen' | 'marker' | 'eraser'

export const PALETTE = [
  '#f4f4f5',
  '#a1a1aa',
  '#38bdf8',
  '#2563eb',
  '#34d399',
  '#16a34a',
  '#fbbf24',
  '#f97316',
  '#fb7185',
  '#dc2626',
  '#a78bfa',
  '#f472b6',
]

interface ToolCfg {
  color: string
  width: number
}

// Zustand aller Zeichenwerkzeuge: jedes merkt sich Farbe und Stärke
export function useInkTools() {
  const [tool, setTool] = useState<Tool>('pen')
  const [pen, setPen] = useState<ToolCfg>({ color: PALETTE[0], width: 3 })
  const [marker, setMarker] = useState<ToolCfg>({ color: '#fbbf24', width: 6 })
  const [eraser, setEraser] = useState<{ mode: 'pixel' | 'stroke'; size: number }>({
    mode: 'pixel',
    size: 30,
  })
  const [finger, setFinger] = useState(false)

  const cfg = tool === 'marker' ? marker : pen
  const settings: InkSettings =
    tool === 'eraser'
      ? { tool, color: '#000', width: eraser.size, eraserMode: eraser.mode, finger }
      : { tool, color: cfg.color, width: cfg.width, eraserMode: 'stroke', finger }

  return { tool, setTool, pen, setPen, marker, setMarker, eraser, setEraser, finger, setFinger, settings }
}

export type InkTools = ReturnType<typeof useInkTools>

const ICONS: Record<Tool, React.ReactNode> = {
  pen: (
    <>
      <path d="M4 20l1-4L16.500 4.500l3 3L8 19z" />
      <path d="M14 7l3 3" />
    </>
  ),
  marker: (
    <>
      <path d="M9 19l-4 1 1-4 8.500-8.500 3 3z" />
      <path d="M14 6.500L16.500 4l3.500 3.500L17.500 10" />
    </>
  ),
  eraser: (
    <>
      <path d="M5.500 14.500L14 6l5 5-6.500 6.500H8z" />
      <path d="M10 20h9" />
    </>
  ),
}

const LABEL: Record<Tool, string> = { pen: 'Stift', marker: 'Marker', eraser: 'Radierer' }

function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.800"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[tool]}
    </svg>
  )
}

interface Props {
  tools: InkTools
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export default function InkToolbar({ tools, canUndo, canRedo, onUndo, onRedo }: Props) {
  const [open, setOpen] = useState(false)
  const { tool } = tools
  const cfg = tool === 'marker' ? tools.marker : tools.pen
  const setCfg = tool === 'marker' ? tools.setMarker : tools.setPen

  const pick = (t: Tool) => {
    if (t === tool) setOpen((o) => !o)
    else {
      tools.setTool(t)
      setOpen(true)
    }
  }

  const range =
    tool === 'marker'
      ? { min: 2, max: 14, value: cfg.width }
      : tool === 'pen'
        ? { min: 1, max: 20, value: cfg.width }
        : { min: 10, max: 90, value: tools.eraser.size }

  return (
    <div className="inkbar2">
      {open && (
        <div className="inkpop" role="dialog" aria-label="Werkzeug-Einstellungen">
          <div className="pop-tools">
            {(['pen', 'marker', 'eraser'] as const).map((t) => (
              <button
                key={t}
                className={`pop-tool ${tool === t ? 'on' : ''}`}
                onClick={() => tools.setTool(t)}
              >
                <ToolIcon tool={t} />
                <span>{LABEL[t]}</span>
              </button>
            ))}
          </div>

          {tool === 'eraser' && (
            <div className="pop-seg">
              <button
                className={tools.eraser.mode === 'pixel' ? 'on' : ''}
                onClick={() => tools.setEraser({ ...tools.eraser, mode: 'pixel' })}
              >
                Pixel
              </button>
              <button
                className={tools.eraser.mode === 'stroke' ? 'on' : ''}
                onClick={() => tools.setEraser({ ...tools.eraser, mode: 'stroke' })}
              >
                Ganzer Strich
              </button>
            </div>
          )}

          {tool !== 'eraser' && (
            <>
              <div className="palette">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    aria-label={`Farbe ${c}`}
                    className={`swatch ${cfg.color === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setCfg({ ...cfg, color: c })}
                  />
                ))}
                <label className="swatch custom" aria-label="Eigene Farbe" title="Eigene Farbe">
                  <input
                    type="color"
                    value={cfg.color}
                    onChange={(e) => setCfg({ ...cfg, color: e.target.value })}
                  />
                </label>
              </div>
            </>
          )}

          {(tool !== 'eraser' || tools.eraser.mode === 'pixel') && (
            <div className="pop-slider">
              <span className="muted">{tool === 'eraser' ? 'Größe' : 'Stärke'}</span>
              <input
                type="range"
                min={range.min}
                max={range.max}
                value={range.value}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (tool === 'eraser') tools.setEraser({ ...tools.eraser, size: v })
                  else setCfg({ ...cfg, width: v })
                }}
              />
              <span className="preview">
                {tool === 'eraser' ? (
                  <i
                    className="pv-eraser"
                    style={{
                      width: Math.max(8, tools.eraser.size * 0.45),
                      height: Math.max(8, tools.eraser.size * 0.45),
                    }}
                  />
                ) : (
                  <i
                    className="pv-line"
                    style={{
                      background: cfg.color,
                      height: Math.max(2, cfg.width * (tool === 'marker' ? 2 : 1)),
                      opacity: tool === 'marker' ? 0.45 : 1,
                    }}
                  />
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="tool-row">
        {(['pen', 'marker', 'eraser'] as const).map((t) => (
          <button
            key={t}
            className={`tbtn ${tool === t ? 'on' : ''}`}
            aria-label={LABEL[t]}
            aria-pressed={tool === t}
            onClick={() => pick(t)}
          >
            <ToolIcon tool={t} />
            <i
              className="tdot"
              style={{
                background:
                  t === 'eraser' ? 'transparent' : t === 'marker' ? tools.marker.color : tools.pen.color,
              }}
            />
          </button>
        ))}
        <span className="sep" />
        <button className="tbtn small" aria-label="Rückgängig" disabled={!canUndo} onClick={onUndo}>
          ↶
        </button>
        <button className="tbtn small" aria-label="Wiederholen" disabled={!canRedo} onClick={onRedo}>
          ↷
        </button>
        <span className="sep" />
        <button
          className={`tbtn text ${tools.finger ? 'on' : ''}`}
          onClick={() => tools.setFinger(!tools.finger)}
          title="Standard: nur der Stift zeichnet, der Finger scrollt"
        >
          Finger
        </button>
      </div>
    </div>
  )
}
