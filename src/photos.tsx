import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { del, get, set } from 'idb-keyval'

export interface PhotoMeta {
  id: string
  ownerId: string
  createdAt: string
}

const INDEX_KEY = 'photo-index'
const blobKey = (id: string) => `photo:${id}`
const MAX_SIDE = 1600

interface PhotoApi {
  metas: PhotoMeta[]
  loaded: boolean
  add: (ownerId: string, files: File[]) => Promise<void>
  remove: (id: string) => void
  cleanup: (validOwners: Set<string>) => void
  url: (id: string) => Promise<string | null>
}

const noop = async () => {}
const PhotoContext = createContext<PhotoApi>({
  metas: [],
  loaded: true,
  add: noop,
  remove: () => {},
  cleanup: () => {},
  url: async () => null,
})

interface Stored {
  type: string
  buf: ArrayBuffer
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
  const [metas, setMetas] = useState<PhotoMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<PhotoMeta[]>([])
  const urls = useRef(new Map<string, string>())

  useEffect(() => {
    get<PhotoMeta[]>(INDEX_KEY)
      .then((v) => {
        ref.current = v ?? []
        setMetas(ref.current)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const commit = useCallback((next: PhotoMeta[]) => {
    ref.current = next
    setMetas(next)
    void set(INDEX_KEY, next)
  }, [])

  const dropBlob = useCallback((id: string) => {
    void del(blobKey(id))
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
        commit([...ref.current, ...added])
      },
      remove(id) {
        dropBlob(id)
        commit(ref.current.filter((m) => m.id !== id))
      },
      cleanup(valid) {
        const orphans = ref.current.filter((m) => !valid.has(m.ownerId))
        if (!orphans.length) return
        orphans.forEach((m) => dropBlob(m.id))
        commit(ref.current.filter((m) => valid.has(m.ownerId)))
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
    }),
    [metas, loaded, commit, dropBlob],
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
