import { useEffect, useRef, useState } from 'react'
import InkCanvas from '../components/InkCanvas'
import InkToolbar, { useInkTools } from '../components/InkToolbar'
import { Header } from '../components/ui'
import { PhotoImg, usePhotoApi } from '../photos'
import { addDays, dayKey, todayKey } from '../stats'
import type { NoteBlock, NoteEntry, Stroke } from '../types'

interface Props {
  notes: NoteEntry[]
  onSave: (n: NoteEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const uid = () => crypto.randomUUID()

const stamp = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
}

const textOf = (n: NoteEntry) =>
  n.blocks
    .filter((b): b is Extract<NoteBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

const titleOf = (n: NoteEntry) =>
  n.title.trim() || textOf(n).split('\n').find((l) => l.trim())?.slice(0, 60) || 'Ohne Titel'

export default function Notes({ notes, onSave, onDelete, onBack }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const open = notes.find((n) => n.id === openId)

  if (open) {
    return (
      <NoteEditor
        key={open.id}
        note={open}
        onSave={onSave}
        onDelete={(id) => {
          onDelete(id)
          setOpenId(null)
        }}
        onBack={() => setOpenId(null)}
      />
    )
  }

  const create = () => {
    const now = new Date().toISOString()
    const n: NoteEntry = {
      id: uid(),
      at: now,
      updatedAt: now,
      title: '',
      blocks: [{ id: uid(), type: 'text', text: '' }],
    }
    onSave(n)
    setOpenId(n.id)
  }

  const q = query.trim().toLowerCase()
  const shown = [...notes]
    .filter((n) => !q || `${n.title}\n${textOf(n)}`.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const groups = new Map<string, NoteEntry[]>()
  for (const n of shown) {
    const k = dayKey(new Date(n.updatedAt))
    groups.set(k, [...(groups.get(k) ?? []), n])
  }
  const today = todayKey()
  const yesterday = dayKey(addDays(new Date(), -1))
  const title = (k: string) =>
    k === today
      ? 'Heute'
      : k === yesterday
        ? 'Gestern'
        : new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })

  return (
    <main className="app">
      <Header title="Notizen" onBack={onBack} />
      <button className="cta" onClick={create}>
        + Neue Seite
      </button>
      <label className="search">
        <input
          type="text"
          value={query}
          placeholder="Notizen durchsuchen…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {shown.length === 0 && (
        <section className="card">
          <p className="muted">{q ? 'Nichts gefunden' : 'Noch keine Notizen'}</p>
          <p className="hint">
            Jede Seite kann Text, Handschrift oder Zeichnungen (Apple Pencil) und eingefügte Bilder
            oder Screenshots enthalten und bekommt automatisch einen Zeitstempel.
          </p>
        </section>
      )}

      {[...groups].map(([day, list]) => (
        <div key={day} className="notegroup">
          <p className="muted section">{title(day)}</p>
          {list.map((n) => {
            const inks = n.blocks.filter((b) => b.type === 'ink').length
            const imgs = n.blocks.filter((b) => b.type === 'image').length
            const preview = textOf(n).replace(/\s+/g, ' ').trim().slice(0, 90)
            return (
              <button key={n.id} className="card notecard" onClick={() => setOpenId(n.id)}>
                <b>{titleOf(n)}</b>
                {preview && n.title.trim() && <span className="note-prev">{preview}</span>}
                <small className="muted">
                  {stamp(n.updatedAt)}
                  {inks > 0 && ` · ${inks} Zeichnung${inks > 1 ? 'en' : ''}`}
                  {imgs > 0 && ` · ${imgs} Bild${imgs > 1 ? 'er' : ''}`}
                </small>
              </button>
            )
          })}
        </div>
      ))}
    </main>
  )
}

function AutoText({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return (
    <textarea
      ref={ref}
      className="ntext"
      rows={2}
      value={value}
      placeholder="Schreiben…"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function NoteEditor({
  note,
  onSave,
  onDelete,
  onBack,
}: {
  note: NoteEntry
  onSave: (n: NoteEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}) {
  const photos = usePhotoApi()
  const [draft, setDraft] = useState(note)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirty = useRef(false)
  const [active, setActive] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tools = useInkTools()
  // Verlauf pro Zeichenfläche für Rückgängig und Wiederholen
  const hist = useRef<Record<string, { past: Stroke[][]; future: Stroke[][] }>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const flush = () => {
    if (!dirty.current) return
    dirty.current = false
    onSaveRef.current({ ...draftRef.current, updatedAt: new Date().toISOString() })
  }

  // Automatisch speichern, kurz nach der letzten Änderung und beim Verlassen
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(flush, 700)
    return () => clearTimeout(t)
  }, [draft])
  useEffect(() => () => flush(), [])

  const change = (fn: (n: NoteEntry) => NoteEntry) => {
    dirty.current = true
    setDraft(fn)
  }
  const setBlock = (id: string, patch: Partial<NoteBlock>) =>
    change((n) => ({
      ...n,
      blocks: n.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as NoteBlock) : b)),
    }))
  const append = (...blocks: NoteBlock[]) =>
    change((n) => ({ ...n, blocks: [...n.blocks, ...blocks] }))

  const addText = () => {
    const b: NoteBlock = { id: uid(), type: 'text', text: '' }
    append(b)
    setFocusId(b.id)
    setActive(b.id)
  }
  const addInk = () => {
    const b: NoteBlock = { id: uid(), type: 'ink', h: 600, strokes: [] }
    append(b)
    setActive(b.id)
  }

  const addImages = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    try {
      const ids = await photos.add(note.id, files)
      append(...ids.map((photoId): NoteBlock => ({ id: uid(), type: 'image', photoId })))
    } finally {
      setBusy(false)
    }
  }

  const pasteImage = async () => {
    try {
      const items = await navigator.clipboard.read()
      const files: File[] = []
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (type) files.push(new File([await it.getType(type)], 'eingefuegt.png', { type }))
      }
      if (files.length) await addImages(files)
      else alert('In der Zwischenablage ist kein Bild.')
    } catch {
      alert('Einfügen wurde nicht erlaubt. Halte alternativ in einem Textfeld gedrückt und wähle „Einfügen“.')
    }
  }

  const imagesFrom = (list?: FileList | null) =>
    [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

  const removeBlock = (b: NoteBlock) => {
    if (b.type === 'image') photos.remove(b.photoId)
    change((n) => ({ ...n, blocks: n.blocks.filter((x) => x.id !== b.id) }))
  }

  const move = (id: string, dir: -1 | 1) =>
    change((n) => {
      const i = n.blocks.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= n.blocks.length) return n
      const blocks = [...n.blocks]
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
      return { ...n, blocks }
    })

  const hasInk = draft.blocks.some((b) => b.type === 'ink')
  const inkBlocks = draft.blocks.filter((b): b is Extract<NoteBlock, { type: 'ink' }> => b.type === 'ink')
  // Rückgängig/Wiederholen gelten für die ausgewählte Zeichenfläche, sonst für die letzte
  const target = inkBlocks.find((b) => b.id === active) ?? inkBlocks[inkBlocks.length - 1]
  const histOf = (id: string) => (hist.current[id] ??= { past: [], future: [] })
  // Jede Änderung der Zeichnung (Strich, Radieren, Leeren) merkt sich den vorherigen Stand
  const commitInk = (b: Extract<NoteBlock, { type: 'ink' }>, strokes: Stroke[]) => {
    const h = histOf(b.id)
    h.past = [...h.past.slice(-49), b.strokes]
    h.future = []
    setBlock(b.id, { strokes })
  }
  const undo = () => {
    if (!target) return
    const h = histOf(target.id)
    const prev = h.past[h.past.length - 1]
    if (!prev) return
    h.past = h.past.slice(0, -1)
    h.future = [...h.future, target.strokes]
    setBlock(target.id, { strokes: prev })
  }
  const redoStroke = () => {
    if (!target) return
    const h = histOf(target.id)
    const next = h.future[h.future.length - 1]
    if (!next) return
    h.future = h.future.slice(0, -1)
    h.past = [...h.past, target.strokes]
    setBlock(target.id, { strokes: next })
  }

  return (
    <main
      className="app notepage"
      onPaste={(e) => {
        const files = imagesFrom(e.clipboardData?.files)
        if (files.length) {
          e.preventDefault()
          void addImages(files)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const files = imagesFrom(e.dataTransfer?.files)
        if (files.length) {
          e.preventDefault()
          void addImages(files)
        }
      }}
    >
      <Header
        title="Seite"
        onBack={() => {
          flush()
          onBack()
        }}
      />

      <input
        className="ntitle"
        type="text"
        value={draft.title}
        placeholder="Titel"
        onChange={(e) => change((n) => ({ ...n, title: e.target.value }))}
      />
      <p className="nstamp muted">
        Erstellt {stamp(draft.at)}
        {draft.updatedAt !== draft.at && ` · bearbeitet ${stamp(draft.updatedAt)}`}
      </p>

      <div className="nblocks">
        {draft.blocks.map((b) => (
          <div
            key={b.id}
            className={`nblock ${b.type} ${active === b.id ? 'active' : ''}`}
            onClick={() => setActive(b.id)}
          >
            {b.type === 'text' && (
              <AutoText
                value={b.text}
                autoFocus={focusId === b.id}
                onChange={(text) => setBlock(b.id, { text })}
              />
            )}
            {b.type === 'ink' && (
              <InkCanvas
                strokes={b.strokes}
                h={b.h}
                settings={tools.settings}
                onChange={(strokes: Stroke[]) => commitInk(b, strokes)}
              />
            )}
            {b.type === 'image' && <PhotoImg id={b.photoId} className="nimg" />}

            {active === b.id && (
              <div className="nctl" onClick={(e) => e.stopPropagation()}>
                <button aria-label="Nach oben" onClick={() => move(b.id, -1)}>
                  ↑
                </button>
                <button aria-label="Nach unten" onClick={() => move(b.id, 1)}>
                  ↓
                </button>
                {b.type === 'ink' && (
                  <>
                    <button
                      disabled={b.strokes.length === 0}
                      onClick={() => confirm('Zeichnung leeren?') && commitInk(b, [])}
                    >
                      Leeren
                    </button>
                    <button onClick={() => setBlock(b.id, { h: b.h + 300 })}>Höher</button>
                    <button
                      disabled={b.h <= 300}
                      onClick={() => setBlock(b.id, { h: Math.max(300, b.h - 300) })}
                    >
                      Niedriger
                    </button>
                  </>
                )}
                <button
                  className="del"
                  aria-label="Block löschen"
                  onClick={() => confirm('Block löschen?') && removeBlock(b)}
                >
                  Löschen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        className="ghost danger wide"
        onClick={() => {
          if (confirm('Ganze Seite löschen?')) {
            dirty.current = false
            onDelete(note.id)
          }
        }}
      >
        Seite löschen
      </button>

      <div className="notebar">
        {hasInk && (
          <InkToolbar
            tools={tools}
            canUndo={!!target && (hist.current[target.id]?.past.length ?? 0) > 0}
            canRedo={!!target && (hist.current[target.id]?.future.length ?? 0) > 0}
            onUndo={undo}
            onRedo={redoStroke}
          />
        )}
        <div className="addbar">
          <button onClick={addText}>+ Text</button>
          <button onClick={addInk}>+ Zeichnen</button>
          <button disabled={busy} onClick={() => fileRef.current?.click()}>
            + Bild
          </button>
          <button disabled={busy} onClick={pasteImage}>
            Einfügen
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = imagesFrom(e.target.files)
          e.target.value = ''
          void addImages(files)
        }}
      />
    </main>
  )
}
