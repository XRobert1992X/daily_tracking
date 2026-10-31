import { useRef, useState } from 'react'
import { PhotoImg, usePhotos } from '../photos'
import { CameraIcon } from './icons'

// Fotos zu einem Eintrag: Vorschaubilder, Hinzufügen und Vollbildansicht mit Löschen
export function Attach({ ownerId }: { ownerId: string }) {
  const { photos, add, remove } = usePhotos(ownerId)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="attach">
      <div className="thumbs">
        {photos.map((p) => (
          <button key={p.id} className="thumb" onClick={() => setOpen(p.id)} aria-label="Foto ansehen">
            <PhotoImg id={p.id} />
          </button>
        ))}
        <button className="addphoto" disabled={busy} onClick={() => input.current?.click()}>
          <CameraIcon />
          <span>{busy ? 'Speichert…' : photos.length ? 'Weitere' : 'Foto'}</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (!files.length) return
          setBusy(true)
          try {
            await add(files)
          } finally {
            setBusy(false)
          }
        }}
      />
      {open && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <PhotoImg id={open} className="lightbox-img" />
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <button
              className="ghost danger"
              onClick={() => {
                if (confirm('Foto löschen?')) {
                  remove(open)
                  setOpen(null)
                }
              }}
            >
              Löschen
            </button>
            <button className="ghost" onClick={() => setOpen(null)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Kleiner Hinweis in Listenzeilen, wenn ein Eintrag Fotos hat
export function PhotoBadge({ ownerId }: { ownerId: string }) {
  const { photos } = usePhotos(ownerId)
  if (!photos.length) return null
  return (
    <span className="pbadge" title={`${photos.length} Foto(s)`}>
      <CameraIcon size={13} />
      {photos.length}
    </span>
  )
}

// Foto-Knopf für Listenzeilen (<li>): klappt darunter die Fotos des Eintrags auf
export function RowPhotos({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(false)
  const { photos } = usePhotos(ownerId)
  return (
    <>
      <button className="x cam" aria-label="Fotos" onClick={() => setOpen((o) => !o)}>
        <CameraIcon size={16} />
        {photos.length > 0 && <small>{photos.length}</small>}
      </button>
      {open && (
        <div className="li-attach">
          <Attach ownerId={ownerId} />
        </div>
      )}
    </>
  )
}
