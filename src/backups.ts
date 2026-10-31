import { del, get, set } from 'idb-keyval'
import type { PhotoMeta } from './photos'
import type { Row, StoreName } from './storage'

export type SnapshotReason = 'auto' | 'manual' | 'before-import' | 'before-restore'

export interface SnapshotMeta {
  id: string
  at: string
  reason: SnapshotReason
  entries: number
  photoIds: string[]
}

export interface SnapshotData {
  data: Record<StoreName, Row[]>
  photos: PhotoMeta[]
  dietTdee: number
}

export const REASON_LABEL: Record<SnapshotReason, string> = {
  auto: 'Automatisch',
  manual: 'Manuell',
  'before-import': 'Vor Import',
  'before-restore': 'Vor Wiederherstellung',
}

const INDEX = 'snapshot-index'
const dataKey = (id: string) => `snapshot:${id}`
const KEEP_AUTO = 14
const KEEP_OTHER = 8

export async function listSnapshots() {
  return (await get<SnapshotMeta[]>(INDEX)) ?? []
}

// Die Bilder selbst werden nicht kopiert, sondern bleiben gespeichert, solange eine Sicherung sie braucht
export function pinnedPhotoIds(list: SnapshotMeta[]) {
  return new Set(list.flatMap((s) => s.photoIds))
}

export async function createSnapshot(
  data: Record<StoreName, Row[]>,
  photos: PhotoMeta[],
  dietTdee: number,
  reason: SnapshotReason,
) {
  const id = crypto.randomUUID()
  const meta: SnapshotMeta = {
    id,
    at: new Date().toISOString(),
    reason,
    entries: Object.values(data).reduce((a, l) => a + l.length, 0),
    photoIds: photos.map((p) => p.id),
  }
  await set(dataKey(id), { data, photos, dietTdee } satisfies SnapshotData)

  let list = [meta, ...(await listSnapshots())]
  const keep = new Set<string>()
  let auto = 0
  let other = 0
  for (const s of list) {
    if (s.reason === 'auto' ? ++auto <= KEEP_AUTO : ++other <= KEEP_OTHER) keep.add(s.id)
  }
  for (const s of list) if (!keep.has(s.id)) await del(dataKey(s.id))
  list = list.filter((s) => keep.has(s.id))
  await set(INDEX, list)
  return list
}

export function loadSnapshot(id: string) {
  return get<SnapshotData>(dataKey(id))
}

export async function deleteSnapshot(id: string) {
  await del(dataKey(id))
  const list = (await listSnapshots()).filter((s) => s.id !== id)
  await set(INDEX, list)
  return list
}
