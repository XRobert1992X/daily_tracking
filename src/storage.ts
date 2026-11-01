import { useEffect, useState } from 'react'
import type { ExportPhoto } from './photos'
import { SyncStore, registerStore } from './sync/store'
import type { Row } from './sync/store'
import type { ActiveSession, Settings } from './types'

export type { Row }

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

// Eine Sammlung, die lokal gespeichert und (falls eingerichtet) mit der Cloud abgeglichen wird
export function useSyncStore<T extends Row>(
  syncName: string,
  idbKey: string,
  sort?: (a: T, b: T) => number,
): Collection<T> {
  const [store] = useState(() => new SyncStore<T>(idbKey, sort))
  const [view, setView] = useState({ items: store.items, loaded: store.loaded })

  useEffect(() => {
    const unsub = store.subscribe(() => setView({ items: store.items, loaded: store.loaded }))
    const unreg = registerStore(syncName, store)
    void store.load()
    return () => {
      unsub()
      unreg()
    }
  }, [store, syncName])

  return {
    items: view.items,
    loaded: view.loaded,
    upsert: store.upsert,
    remove: store.remove,
    removeWhere: store.removeWhere,
    merge: store.merge,
    replaceAll: store.replaceAll,
  }
}

export function useCollection<T extends Row>(
  name: StoreName,
  sort?: (a: T, b: T) => number,
): Collection<T> {
  return useSyncStore<T>(name, KEYS[name], sort)
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
