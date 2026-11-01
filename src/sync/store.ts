import { get, set } from 'idb-keyval'

export type Row = { id: string }

// u: Zeitpunkt der letzten Änderung (ms), s: u beim letzten erfolgreichen Abgleich, d: gelöscht (Tombstone)
interface Meta {
  u: number
  s?: number
  d?: 1
}

export interface SyncEntry {
  id: string
  u: number
  deleted: boolean
  data: unknown
}

export interface RemoteRow {
  id: string
  u: number
  deleted: boolean
  data: unknown
}

// Wird von der Sync-Engine benutzt, ohne die Datentypen zu kennen
export interface SyncableStore {
  isLoaded(): boolean
  dirty(): SyncEntry[]
  markSynced(entries: { id: string; u: number }[]): void
  applyRemote(rows: RemoteRow[]): number
  liveIds(): string[]
  deadIds(): string[]
  touch(): void
}

const registry = new Map<string, SyncableStore>()

export function registerStore(name: string, store: SyncableStore) {
  registry.set(name, store)
  return () => {
    if (registry.get(name) === store) registry.delete(name)
  }
}

export const getStores = () => registry

// Lokale Änderungen (nicht der Empfang von Daten) stoßen den Abgleich an
const changeListeners = new Set<() => void>()
export const onLocalChange = (fn: () => void) => {
  changeListeners.add(fn)
  return () => {
    changeListeners.delete(fn)
  }
}

export class SyncStore<T extends Row> implements SyncableStore {
  items: T[] = []
  loaded = false
  private meta: Record<string, Meta> = {}
  private listeners = new Set<() => void>()
  private loading: Promise<void> | null = null
  private key: string
  private sort?: (a: T, b: T) => number

  constructor(key: string, sort?: (a: T, b: T) => number) {
    this.key = key
    this.sort = sort
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const [items, meta] = await Promise.all([
          get<T[]>(this.key),
          get<Record<string, Meta>>(`${this.key}:meta`),
        ])
        this.meta = meta ?? {}
        const list = items ?? []
        // Bestehende Daten ohne Verlauf gelten als „neu geändert“ und werden beim ersten Abgleich hochgeladen
        let added = false
        const now = Date.now()
        for (const it of list) {
          if (!this.meta[it.id]) {
            this.meta[it.id] = { u: now }
            added = true
          }
        }
        this.items = this.sort ? [...list].sort(this.sort) : list
        if (added) void set(`${this.key}:meta`, this.meta)
      } catch {
        // leerer Start
      }
      this.loaded = true
      this.emit()
    })()
    return this.loading
  }

  isLoaded = () => this.loaded

  private persist(items: boolean) {
    if (items) void set(this.key, this.items)
    void set(`${this.key}:meta`, this.meta)
  }

  private stamp(id: string, deleted: boolean) {
    const u = Math.max(Date.now(), (this.meta[id]?.u ?? 0) + 1)
    this.meta[id] = deleted ? { u, d: 1 } : { u }
  }

  private commit(next: T[], touched: string[], removed: string[]) {
    this.items = this.sort ? [...next].sort(this.sort) : next
    for (const id of touched) this.stamp(id, false)
    for (const id of removed) this.stamp(id, true)
    this.persist(true)
    this.emit()
    changeListeners.forEach((fn) => fn())
  }

  upsert = (item: T) => {
    const cur = this.items
    this.commit(
      cur.some((x) => x.id === item.id) ? cur.map((x) => (x.id === item.id ? item : x)) : [...cur, item],
      [item.id],
      [],
    )
  }

  remove = (id: string) => {
    if (!this.items.some((x) => x.id === id)) return
    this.commit(
      this.items.filter((x) => x.id !== id),
      [],
      [id],
    )
  }

  removeWhere = (fn: (item: T) => boolean) => {
    const gone = this.items.filter(fn).map((x) => x.id)
    if (!gone.length) return
    this.commit(
      this.items.filter((x) => !fn(x)),
      [],
      gone,
    )
  }

  merge = (list: T[]) => {
    const known = new Set(this.items.map((x) => x.id))
    const fresh = list.filter((x) => !known.has(x.id))
    if (fresh.length)
      this.commit(
        [...this.items, ...fresh],
        fresh.map((x) => x.id),
        [],
      )
    return fresh.length
  }

  // Ersetzt alles (Wiederherstellen): Geändertes wird neu gestempelt, Fehlendes als gelöscht markiert
  replaceAll = (list: T[]) => {
    const before = new Map(this.items.map((x) => [x.id, JSON.stringify(x)]))
    const ids = new Set(list.map((x) => x.id))
    const touched = list.filter((x) => before.get(x.id) !== JSON.stringify(x)).map((x) => x.id)
    const removed = [...before.keys()].filter((id) => !ids.has(id))
    this.commit(list, touched, removed)
  }

  // Lädt die Anzeige neu, obwohl sich die Einträge nicht geändert haben (z. B. nach dem Laden eines Fotos)
  touch = () => {
    this.items = [...this.items]
    this.emit()
  }

  dirty(): SyncEntry[] {
    const byId = new Map(this.items.map((x) => [x.id, x]))
    const out: SyncEntry[] = []
    for (const [id, m] of Object.entries(this.meta)) {
      if (m.s === m.u) continue
      if (m.d) out.push({ id, u: m.u, deleted: true, data: null })
      else {
        const item = byId.get(id)
        if (item) out.push({ id, u: m.u, deleted: false, data: item })
      }
    }
    return out
  }

  markSynced(entries: { id: string; u: number }[]) {
    let changed = false
    for (const e of entries) {
      const m = this.meta[e.id]
      if (m && m.u === e.u && m.s !== e.u) {
        m.s = e.u
        changed = true
      }
    }
    if (changed) this.persist(false)
  }

  // Übernimmt Änderungen aus der Cloud: die jüngere Änderung gewinnt
  applyRemote(rows: RemoteRow[]) {
    let itemsChanged = false
    let metaChanged = false
    let next = this.items
    for (const r of rows) {
      const m = this.meta[r.id]
      if (m && m.u > r.u) continue
      if (m && m.u === r.u) {
        if (m.s !== r.u) {
          m.s = r.u
          metaChanged = true
        }
        continue
      }
      metaChanged = true
      if (r.deleted) {
        this.meta[r.id] = { u: r.u, s: r.u, d: 1 }
        if (next.some((x) => x.id === r.id)) {
          next = next.filter((x) => x.id !== r.id)
          itemsChanged = true
        }
      } else if (r.data && typeof r.data === 'object') {
        this.meta[r.id] = { u: r.u, s: r.u }
        const item = r.data as T
        next = next.some((x) => x.id === r.id) ? next.map((x) => (x.id === r.id ? item : x)) : [...next, item]
        itemsChanged = true
      }
    }
    if (itemsChanged) this.items = this.sort ? [...next].sort(this.sort) : next
    if (itemsChanged || metaChanged) this.persist(itemsChanged)
    if (itemsChanged) this.emit()
    return itemsChanged ? rows.length : 0
  }

  liveIds() {
    return this.items.map((x) => x.id)
  }

  deadIds() {
    return Object.entries(this.meta)
      .filter(([, m]) => m.d)
      .map(([id]) => id)
  }
}
