import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { del, get, keys, set } from 'idb-keyval'
import { SyncStore, registerStore } from './sync/store'

export interface PhotoMeta {
  id: string
  ownerId: string
  createdAt: string
}

// Foto im Backup-File: Bild als Base64
export interface ExportPhoto extends PhotoMeta {
  type: string
  data: string
}

const INDEX_KEY = 'photo-index'
export const blobKey = (id: string) => `photo:${id}`
const MAX_SIDE = 1600
const ORPHAN_AGE_MS = 3_600_000

interface PhotoApi {
  metas: PhotoMeta[]
  loaded: boolean
  add: (ownerId: string, files: File[]) => Promise<string[]>
  remove: (id: string) => void
  cleanup: (validOwners: Set<string>) => void
  url: (id: string) => Promise<string | null>
  // Fotos, die von Sicherungen gebraucht werden, bleiben gespeichert
  setPinned: (ids: Set<string>) => void
  gc: () => Promise<void>
  restoreIndex: (metas: PhotoMeta[]) => void
  dumpAll: () => Promise<ExportPhoto[]>
  importAll: (list: ExportPhoto[]) => Promise<number>
}

const noop = async () => {}
const PhotoContext = createContext<PhotoApi>({
  metas: [],
  loaded: true,
  add: async () => [],
  remove: () => {},
  cleanup: () => {},
  url: async () => null,
  setPinned: () => {},
  gc: noop,
  restoreIndex: () => {},
  dumpAll: async () => [],
  importAll: async () => 0,
})

interface Stored {
  type: string
  buf: ArrayBuffer
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function base64ToBuffer(data: string, type: string) {
  const res = await fetch(`data:${type};base64,${data}`)
  return res.arrayBuffer()
}

// Verkleinert Fotos auf max. 1600 px und speichert sie als JPEG, damit der Speicher nicht vollläuft
async function compress(file: File): Promise<Stored> {
  const raw = async (): Promise<Stored> => ({ type: file.type || 'image/jpeg', buf: await file.arrayBuffer() })
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return raw()
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw()
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  return blob ? { type: 'image/jpeg', buf: await blob.arrayBuffer() } : raw()
}

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new SyncStore<PhotoMeta>(INDEX_KEY))
  const [metas, setMetas] = useState<PhotoMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const urls = useRef(new Map<string, string>())
  const pinned = useRef(new Set<string>())

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setMetas(store.items)
      setLoaded(store.loaded)
    })
    const unreg = registerStore('photos', store)
    void store.load()
    return () => {
      unsub()
      unreg()
    }
  }, [store])

  const dropBlob = useCallback((id: string) => {
    // Bilder, die eine Sicherung noch braucht, bleiben im Speicher
    if (!pinned.current.has(id)) void del(blobKey(id))
    const u = urls.current.get(id)
    if (u) {
      URL.revokeObjectURL(u)
      urls.current.delete(id)
    }
  }, [])

  const api = useMemo<PhotoApi>(
    () => ({
      metas,
      loaded,
      async add(ownerId, files) {
        const added: PhotoMeta[] = []
        for (const f of files) {
          const id = crypto.randomUUID()
          await set(blobKey(id), await compress(f))
          added.push({ id, ownerId, createdAt: new Date().toISOString() })
        }
        store.merge(added)
        return added.map((m) => m.id)
      },
      remove(id) {
        dropBlob(id)
        store.remove(id)
      },
      // Nur Fotos, die älter als eine Stunde sind: neu aufgenommene gehören evtl. zu einem noch nicht gespeicherten Eintrag
      cleanup(valid) {
        const orphans = store.items.filter(
          (m) => !valid.has(m.ownerId) && Date.now() - Date.parse(m.createdAt) > ORPHAN_AGE_MS,
        )
        if (!orphans.length) return
        orphans.forEach((m) => dropBlob(m.id))
        const gone = new Set(orphans.map((m) => m.id))
        store.removeWhere((m) => gone.has(m.id))
      },
      async url(id) {
        const cached = urls.current.get(id)
        if (cached) return cached
        const data = await get<Stored>(blobKey(id))
        if (!data) return null
        const u = URL.createObjectURL(new Blob([data.buf], { type: data.type }))
        urls.current.set(id, u)
        return u
      },
      setPinned(ids) {
        pinned.current = ids
      },
      // Löscht Bilder, die weder im Index noch von einer Sicherung gebraucht werden
      async gc() {
        const live = new Set(store.items.map((m) => m.id))
        for (const k of await keys()) {
          const key = String(k)
          if (!key.startsWith('photo:')) continue
          const id = key.slice('photo:'.length)
          if (!live.has(id) && !pinned.current.has(id)) await del(k)
        }
      },
      restoreIndex(list) {
        store.replaceAll(list)
      },
      async dumpAll() {
        const out: ExportPhoto[] = []
        for (const m of store.items) {
          const stored = await get<Stored>(blobKey(m.id))
          if (!stored) continue
          out.push({ ...m, type: stored.type, data: await blobToBase64(new Blob([stored.buf])) })
        }
        return out
      },
      async importAll(list) {
        const known = new Set(store.items.map((m) => m.id))
        const added: PhotoMeta[] = []
        for (const p of list) {
          if (known.has(p.id)) continue
          await set(blobKey(p.id), { type: p.type, buf: await base64ToBuffer(p.data, p.type) })
          added.push({ id: p.id, ownerId: p.ownerId, createdAt: p.createdAt })
        }
        store.merge(added)
        return added.length
      },
    }),
    [metas, loaded, store, dropBlob],
  )

  return <PhotoContext.Provider value={api}>{children}</PhotoContext.Provider>
}

export function usePhotoApi() {
  return useContext(PhotoContext)
}

export function usePhotos(ownerId: string) {
  const api = useContext(PhotoContext)
  const photos = useMemo(() => api.metas.filter((m) => m.ownerId === ownerId), [api.metas, ownerId])
  return { photos, add: (files: File[]) => api.add(ownerId, files), remove: api.remove }
}

export function PhotoImg({ id, className }: { id: string; className?: string }) {
  const api = useContext(PhotoContext)
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void api.url(id).then((u) => alive && setSrc(u))
    return () => {
      alive = false
    }
  }, [api, id])
  return src ? <img src={src} className={className} alt="" /> : <span className={className} />
}
