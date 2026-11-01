import { get, set } from 'idb-keyval'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportPhoto } from './photos'
import type { ActiveSession, Settings } from './types'

export const KEYS = {
  meditation: 'meditation-sessions',
  books: 'books',
  readingLogs: 'reading-logs',
  habits: 'habits',
  habitLogs: 'habit-logs',
  moods: 'moods',
  focus: 'focus-sessions',
  goals: 'goals',
  social: 'social',
  todos: 'todos',
  diet: 'diet',
  trades: 'trades',
  gratitude: 'gratitude',
  cold: 'cold-showers',
  sleep: 'sleep',
  penalties: 'penalties',
  notes: 'notes',
} as const

export type StoreName = keyof typeof KEYS
export type Row = { id: string }

export interface Collection<T extends Row> {
  items: T[]
  loaded: boolean
  upsert: (item: T) => void
  remove: (id: string) => void
  removeWhere: (fn: (item: T) => boolean) => void
  // Methodensyntax, damit Collections verschiedener Typen als Row-Liste nutzbar sind
  merge(list: T[]): number
  replaceAll(list: T[]): void
}

export function useCollection<T extends Row>(
  name: StoreName,
  sort?: (a: T, b: T) => number,
): Collection<T> {
  const [items, setItems] = useState<T[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<T[]>([])
  const sortRef = useRef(sort)

  const commit = useCallback((next: T[]) => {
    const out = sortRef.current ? [...next].sort(sortRef.current) : next
    ref.current = out
    setItems(out)
    void set(KEYS[name], out)
  }, [name])

  useEffect(() => {
    get<T[]>(KEYS[name])
      .then((v) => {
        const list = v ?? []
        ref.current = sortRef.current ? [...list].sort(sortRef.current) : list
        setItems(ref.current)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [name])

  const upsert = useCallback(
    (item: T) => {
      const cur = ref.current
      commit(
        cur.some((x) => x.id === item.id)
          ? cur.map((x) => (x.id === item.id ? item : x))
          : [...cur, item],
      )
    },
    [commit],
  )
  const remove = useCallback(
    (id: string) => commit(ref.current.filter((x) => x.id !== id)),
    [commit],
  )
  const removeWhere = useCallback(
    (fn: (item: T) => boolean) => commit(ref.current.filter((x) => !fn(x))),
    [commit],
  )
  const merge = useCallback(
    (list: T[]) => {
      const known = new Set(ref.current.map((x) => x.id))
      const fresh = list.filter((x) => !known.has(x.id))
      if (fresh.length) commit([...ref.current, ...fresh])
      return fresh.length
    },
    [commit],
  )

  const replaceAll = useCallback((list: T[]) => commit(list), [commit])

  return { items, loaded, upsert, remove, removeWhere, merge, replaceAll }
}

// Bittet Safari, die Daten nicht automatisch zu löschen
export function requestPersistentStorage() {
  void navigator.storage?.persist?.()
}

const ACTIVE_KEY = 'progress:active'

export function loadActive(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? (JSON.parse(raw) as ActiveSession) : null
  } catch {
    return null
  }
}

export function saveActive(a: ActiveSession) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(a))
}

export function clearActive() {
  localStorage.removeItem(ACTIVE_KEY)
}

export type BackupData = { [K in StoreName]?: Row[] }

const LAST_EXPORT_KEY = 'progress:last-export'

export function lastExportAt(): number | null {
  const n = parseInt(localStorage.getItem(LAST_EXPORT_KEY) ?? '', 10)
  return n > 0 ? n : null
}

// Gibt true zurück, wenn die Datei tatsächlich gesichert wurde (nicht bei abgebrochenem Teilen-Dialog)
export async function exportBackup(
  data: Record<StoreName, Row[]>,
  photos: ExportPhoto[],
  settings: Settings,
): Promise<boolean> {
  const json = JSON.stringify({ version: 4, ...data, photos, settings })
  const file = new File([json], `progress-backup-${new Date().toLocaleDateString('sv-SE')}.json`, {
    type: 'application/json',
  })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
      return true
    } catch {
      return false
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
  return true
}

export async function parseBackup(
  file: File,
): Promise<{ stores: BackupData; photos: ExportPhoto[]; settings: Partial<Settings> }> {
  const data = JSON.parse(await file.text())
  const stores: BackupData = {}
  let found = false
  for (const name of Object.keys(KEYS) as StoreName[]) {
    const list: unknown = data?.[name]
    if (Array.isArray(list)) {
      stores[name] = list.filter((x): x is Row => typeof x?.id === 'string')
      found = true
    }
  }
  if (!found) throw new Error('Ungültige Datei')
  const photos: ExportPhoto[] = Array.isArray(data?.photos)
    ? data.photos.filter(
        (p: ExportPhoto) =>
          typeof p?.id === 'string' &&
          typeof p?.ownerId === 'string' &&
          typeof p?.type === 'string' &&
          typeof p?.data === 'string',
      )
    : []
  const s = data?.settings
  const settings: Partial<Settings> = {}
  if (typeof s?.dietTdee === 'number' && s.dietTdee >= 800) settings.dietTdee = s.dietTdee
  if (typeof s?.sleepCfg?.wake === 'string' && typeof s?.sleepCfg?.bed === 'string') {
    settings.sleepCfg = { wake: s.sleepCfg.wake, bed: s.sleepCfg.bed }
  }
  return { stores, photos, settings }
}
