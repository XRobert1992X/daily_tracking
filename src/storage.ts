import { get, set } from 'idb-keyval'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveSession, MeditationSession } from './types'

const KEY = 'meditation-sessions'
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

export function useSessions() {
  const [sessions, setSessions] = useState<MeditationSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<MeditationSession[]>([])

  useEffect(() => {
    get<MeditationSession[]>(KEY)
      .then((v) => {
        ref.current = v ?? []
        setSessions(ref.current)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
    // Bittet Safari, die Daten nicht automatisch zu löschen
    void navigator.storage?.persist?.()
  }, [])

  const commit = useCallback((next: MeditationSession[]) => {
    const sorted = [...next].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    ref.current = sorted
    setSessions(sorted)
    void set(KEY, sorted)
  }, [])

  const add = useCallback(
    (s: MeditationSession) => commit([...ref.current, s]),
    [commit],
  )
  const remove = useCallback(
    (id: string) => commit(ref.current.filter((s) => s.id !== id)),
    [commit],
  )
  const merge = useCallback(
    (incoming: MeditationSession[]) => {
      const known = new Set(ref.current.map((s) => s.id))
      const fresh = incoming.filter((s) => !known.has(s.id))
      commit([...ref.current, ...fresh])
      return fresh.length
    },
    [commit],
  )

  return { sessions, loaded, add, remove, merge }
}

export async function exportBackup(sessions: MeditationSession[]) {
  const json = JSON.stringify({ version: 1, meditation: sessions }, null, 2)
  const file = new File([json], `progress-backup-${new Date().toLocaleDateString('sv-SE')}.json`, {
    type: 'application/json',
  })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch {
      return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

export async function parseBackup(file: File): Promise<MeditationSession[]> {
  const data = JSON.parse(await file.text())
  const list: unknown = data?.meditation
  if (!Array.isArray(list)) throw new Error('Ungültige Datei')
  return list.filter(
    (s): s is MeditationSession =>
      typeof s?.id === 'string' &&
      typeof s?.startedAt === 'string' &&
      typeof s?.actualSec === 'number' &&
      typeof s?.interruptions === 'number',
  )
}
