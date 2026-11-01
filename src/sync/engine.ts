import { get, set } from 'idb-keyval'
import { blobKey } from '../photos'
import { getStores, onLocalChange } from './store'
import type { RemoteRow, SyncEntry } from './store'

export interface PulledRow extends RemoteRow {
  store: string
  syncedAt: string
}

export interface PushRow {
  store: string
  id: string
  u: number
  deleted: boolean
  data: unknown
}

// Alles, was die Engine von der Cloud braucht (Supabase oder eine Testattrappe)
export interface Remote {
  userId(): string | null
  pull(since: string, offset: number, limit: number): Promise<PulledRow[]>
  push(rows: PushRow[]): Promise<void>
  uploadBlob(id: string, blob: Blob): Promise<void>
  downloadBlob(id: string): Promise<Blob | null>
  removeBlobs(ids: string[]): Promise<void>
}

export interface SyncState {
  phase: 'idle' | 'syncing' | 'error'
  lastSync: number | null
  error: string | null
  // Zahl der lokalen Änderungen, die noch nicht in der Cloud sind
  pending: number
}

interface StoredBlob {
  type: string
  buf: ArrayBuffer
}

const PAGE = 500
const OVERLAP_MS = 5000
const PUSH_BYTES = 800_000
const PHOTOS_PER_RUN = 12
const EPOCH = '1970-01-01T00:00:00.000Z'

// Postgres liefert Mikrosekunden (…:09.906123+00:00); auf Millisekunden kürzen, damit jeder Browser sie lesen kann
const parseTs = (s: string) => Date.parse(s.replace(/(\.\d{3})\d+/, '$1'))

export class SyncEngine {
  state: SyncState = { phase: 'idle', lastSync: null, error: null, pending: 0 }
  private remote: Remote
  private expected: string[]
  private listeners = new Set<() => void>()
  private running = false
  private again = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopFns: (() => void)[] = []
  private completed = false

  constructor(remote: Remote, expectedStores: string[]) {
    this.remote = remote
    this.expected = expectedStores
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  // true, sobald seit dem Start mindestens ein kompletter Abgleich gelungen ist und gerade keiner läuft
  isSettled() {
    return this.completed && !this.running
  }

  countPending() {
    let n = 0
    for (const s of getStores().values()) n += s.dirty().length
    return n
  }

  // Startet automatische Abgleiche (Änderungen, Rückkehr in die App, Netz, Zeitgeber)
  start() {
    this.stop()
    const kick = () => this.schedule(300)
    const onVisible = () => document.visibilityState === 'visible' && kick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', kick)
    const interval = setInterval(() => document.visibilityState === 'visible' && kick(), 60_000)
    const unlisten = onLocalChange(() => {
      this.set({ pending: this.countPending() })
      this.schedule(2000)
    })
    this.stopFns = [
      () => document.removeEventListener('visibilitychange', onVisible),
      () => window.removeEventListener('online', kick),
      () => clearInterval(interval),
      unlisten,
    ]
    this.schedule(100)
  }

  stop() {
    this.stopFns.forEach((fn) => fn())
    this.stopFns = []
    clearTimeout(this.timer)
    this.completed = false
  }

  schedule(delay: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  async run() {
    if (!this.remote.userId()) return
    if (this.running) {
      this.again = true
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    this.running = true
    this.set({ phase: 'syncing', error: null })
    try {
      await this.waitForStores()
      await this.pull()
      const moreUp = await this.uploadPhotos()
      await this.push()
      const moreDown = await this.downloadPhotos()
      this.completed = true
      this.set({ phase: 'idle', lastSync: Date.now(), pending: this.countPending() })
      if (moreUp || moreDown) this.again = true
    } catch (e) {
      this.set({ phase: 'error', error: e instanceof Error ? e.message : String(e), pending: this.countPending() })
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        this.schedule(1500)
      }
    }
  }

  private async waitForStores() {
    const until = Date.now() + 15_000
    for (;;) {
      const stores = getStores()
      if (this.expected.every((n) => stores.get(n)?.isLoaded())) return
      if (Date.now() > until) throw new Error('Daten wurden nicht rechtzeitig geladen')
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  private cursorKey() {
    return `progress:sync-cursor:${this.remote.userId()}`
  }

  private async pull() {
    const since = localStorage.getItem(this.cursorKey()) ?? EPOCH
    const lower = new Date(Math.max(0, (parseTs(since) || 0) - OVERLAP_MS)).toISOString()
    let newest = since
    for (let offset = 0; ; offset += PAGE) {
      const rows = await this.remote.pull(lower, offset, PAGE)
      const byStore = new Map<string, RemoteRow[]>()
      for (const r of rows) {
        if (r.syncedAt > newest) newest = r.syncedAt
        byStore.set(r.store, [...(byStore.get(r.store) ?? []), r])
      }
      for (const [name, list] of byStore) getStores().get(name)?.applyRemote(list)
      if (rows.length < PAGE) break
    }
    localStorage.setItem(this.cursorKey(), newest)
  }

  private async push() {
    for (const [name, store] of getStores()) {
      const entries = store.dirty()
      let batch: SyncEntry[] = []
      let bytes = 0
      const flush = async () => {
        if (!batch.length) return
        await this.remote.push(batch.map((e) => ({ store: name, id: e.id, u: e.u, deleted: e.deleted, data: e.data })))
        store.markSynced(batch)
        batch = []
        bytes = 0
      }
      for (const e of entries) {
        const size = JSON.stringify(e.data ?? null).length
        if (batch.length && bytes + size > PUSH_BYTES) await flush()
        batch.push(e)
        bytes += size
      }
      await flush()
    }
  }

  private uploadedKey() {
    return `progress:photos-up:${this.remote.userId()}`
  }

  private loadUploaded() {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(this.uploadedKey()) ?? '[]'))
    } catch {
      return new Set<string>()
    }
  }

  private saveUploaded(s: Set<string>) {
    localStorage.setItem(this.uploadedKey(), JSON.stringify([...s]))
  }

  // Lädt neue Fotos hoch und entfernt gelöschte aus dem Cloud-Speicher. true = es ist noch etwas übrig
  private async uploadPhotos() {
    const photos = getStores().get('photos')
    if (!photos) return false
    const uploaded = this.loadUploaded()
    let n = 0
    let more = false
    for (const id of photos.liveIds()) {
      if (uploaded.has(id)) continue
      const stored = await get<StoredBlob>(blobKey(id))
      if (!stored) continue
      if (n >= PHOTOS_PER_RUN) {
        more = true
        break
      }
      await this.remote.uploadBlob(id, new Blob([stored.buf], { type: stored.type }))
      uploaded.add(id)
      this.saveUploaded(uploaded)
      n++
    }
    const gone = photos.deadIds().filter((id) => uploaded.has(id))
    if (gone.length) {
      await this.remote.removeBlobs(gone)
      gone.forEach((id) => uploaded.delete(id))
      this.saveUploaded(uploaded)
    }
    return more
  }

  // Holt Fotos, die auf diesem Gerät noch fehlen. true = es ist noch etwas übrig
  private async downloadPhotos() {
    const photos = getStores().get('photos')
    if (!photos) return false
    const uploaded = this.loadUploaded()
    let n = 0
    let more = false
    let got = false
    for (const id of photos.liveIds()) {
      if (await get(blobKey(id))) continue
      if (n >= PHOTOS_PER_RUN) {
        more = true
        break
      }
      n++
      const blob = await this.remote.downloadBlob(id)
      if (!blob) continue
      await set(blobKey(id), { type: blob.type || 'image/jpeg', buf: await blob.arrayBuffer() })
      uploaded.add(id)
      got = true
    }
    if (got) {
      this.saveUploaded(uploaded)
      photos.touch()
    }
    // Nur weitermachen, wenn wirklich Fortschritt da war (sonst Endlosschleife bei fehlenden Dateien)
    return more && got
  }
}
