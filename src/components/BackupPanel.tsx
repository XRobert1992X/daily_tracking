import { useRef, useState } from 'react'
import { REASON_LABEL } from '../backups'
import type { SnapshotMeta } from '../backups'

interface Props {
  snapshots: SnapshotMeta[]
  lastExport: number | null
  photoCount: number
  onExport: (withPhotos: boolean) => Promise<void>
  onImport: (file: File) => Promise<string>
  onSnapshotNow: () => Promise<void>
  onRestore: (id: string) => Promise<void>
  onDeleteSnapshot: (id: string) => Promise<void>
}

function ago(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  return days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`
}

export default function BackupPanel({
  snapshots,
  lastExport,
  photoCount,
  onExport,
  onImport,
  onSnapshotNow,
  onRestore,
  onDeleteSnapshot,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [withPhotos, setWithPhotos] = useState(true)

  const run = async (fn: () => Promise<void | string>) => {
    setBusy(true)
    try {
      const r = await fn()
      if (typeof r === 'string') setMsg(r)
    } finally {
      setBusy(false)
    }
  }

  const stale = lastExport === null || Date.now() - lastExport > 7 * 86_400_000

  return (
    <section className="card">
      <p className="muted">Datei-Export</p>
      {photoCount > 0 && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={withPhotos}
            onChange={(e) => setWithPhotos(e.target.checked)}
          />
          <span>{photoCount} Fotos einschließen (Datei wird größer)</span>
        </label>
      )}
      <div className="row">
        <button className="ghost" disabled={busy} onClick={() => run(() => onExport(withPhotos))}>
          Exportieren
        </button>
        <button className="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          Importieren
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void run(() => onImport(f))
        }}
      />
      <p className={`hint ${stale ? 'bad' : ''}`}>
        {lastExport === null
          ? 'Noch nie exportiert. Speichere die Datei z. B. in iCloud Drive oder Dateien.'
          : `Letzter Export: ${ago(lastExport)}`}
      </p>
      {msg && <p className="hint">{msg}</p>}

      <details className="snaps">
        <summary>Automatische Sicherungen ({snapshots.length})</summary>
        <button className="ghost wide" disabled={busy} onClick={() => run(onSnapshotNow)}>
          Jetzt sichern
        </button>
        <ul className="erows">
          {snapshots.map((s) => {
            const d = new Date(s.at)
            return (
              <li key={s.id}>
                <div className="erow static">
                  <span className="emain">
                    <b>
                      {d.toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}{' '}
                      {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </b>
                    <small>
                      {REASON_LABEL[s.reason]} · {s.entries} Einträge
                      {s.photoIds.length > 0 && ` · ${s.photoIds.length} Fotos`}
                    </small>
                  </span>
                  <span className="emeta">
                    <button
                      className="mini-btn"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            `Stand vom ${d.toLocaleString('de-DE')} wiederherstellen? Der aktuelle Stand wird vorher gesichert.`,
                          )
                        ) {
                          void run(async () => {
                            await onRestore(s.id)
                            return 'Stand wiederhergestellt'
                          })
                        }
                      }}
                    >
                      Wiederherstellen
                    </button>
                    <button
                      className="x"
                      aria-label="Sicherung löschen"
                      disabled={busy}
                      onClick={() => confirm('Sicherung löschen?') && void run(() => onDeleteSnapshot(s.id))}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        {snapshots.length === 0 && <p className="hint">Noch keine Sicherung.</p>}
        <p className="hint">
          Es wird einmal täglich beim Öffnen automatisch gesichert (die letzten 14), außerdem vor
          jedem Import und jeder Wiederherstellung. Die Sicherungen liegen auf diesem Gerät. Sie
          schützen vor Fehlern und versehentlichem Löschen, aber nicht vor dem Verlust des Geräts
          oder dem Löschen der App. Dafür dient der Datei-Export.
        </p>
      </details>
    </section>
  )
}
