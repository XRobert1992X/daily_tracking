import { get, set } from 'idb-keyval'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveSession } from './types'

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
} as const

export type StoreName = keyof typeof KEYS
export type Row = { id: string }

export interface Collection<T extends Row> {
  items: T[]
  upsert: (item: T) => void
  remove: (id: string) => void
  removeWhere: (fn: (item: T) => boolean) => void
  // Methodensyntax, damit Collections verschiedener Typen als Row-Liste nutzbar sind
  merge(list: T[]): number
}

export function useCollection<T extends Row>(
  name: StoreName,
  sort?: (a: T, b: T) => number,
): Collection<T> {
  const [items, setItems] = useState<T[]>([])
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

  return { items, upsert, remove, removeWhere, merge }
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

export async function exportBackup(data: Record<StoreName, Row[]>) {
  const json = JSON.stringify({ version: 2, ...data }, null, 2)
  const file = new File([json], `progress-backup-${new Date().toLocaleDateString('sv-SE')}.json`, {
    type: 'application/json',
  })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch {
      // abgebrochen
    }
    return
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

export async function parseBackup(file: File): Promise<BackupData> {
  const data = JSON.parse(await file.text())
  const out: BackupData = {}
  let found = false
  for (const name of Object.keys(KEYS) as StoreName[]) {
    const list: unknown = data?.[name]
    if (Array.isArray(list)) {
      out[name] = list.filter((x): x is Row => typeof x?.id === 'string')
      found = true
    }
  }
  if (!found) throw new Error('Ungültige Datei')
  return out
}
