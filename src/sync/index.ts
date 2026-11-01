import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SYNC } from './config'
import { SyncEngine } from './engine'
import type { SyncState } from './engine'
import { connect, supabaseRemote } from './supabase'
import type { SyncConfig } from './supabase'

const CFG_KEY = 'progress:sync-cfg'

export interface SyncSnapshot {
  configured: boolean
  ready: boolean
  email: string | null
  // Fehler bei Einrichtung oder Anmeldung (Abgleichfehler stehen in sync.error)
  setupError: string | null
  sync: SyncState
}

let snapshot: SyncSnapshot = {
  configured: false,
  ready: false,
  email: null,
  setupError: null,
  sync: { phase: 'idle', lastSync: null, error: null, pending: 0 },
}
const subs = new Set<() => void>()

function update(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  subs.forEach((fn) => fn())
}

export function useSync() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    () => snapshot,
  )
}

export function getConfig(): SyncConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) ?? '')
    if (typeof c?.url === 'string' && typeof c?.key === 'string' && c.url && c.key) return c
  } catch {
    // Standardwerte
  }
  return DEFAULT_SYNC.url && DEFAULT_SYNC.key ? DEFAULT_SYNC : null
}

export function saveConfig(url: string, key: string) {
  const u = url.trim().replace(/\/+$/, '')
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) throw new Error('Die URL muss mit https:// beginnen')
  if (key.trim().length < 20) throw new Error('Der Schlüssel (anon public key) ist zu kurz')
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: u, key: key.trim() }))
  window.location.reload()
}

export async function resetConfig() {
  await client?.auth.signOut().catch(() => {})
  localStorage.removeItem(CFG_KEY)
  window.location.reload()
}

let client: SupabaseClient | null = null
let engine: SyncEngine | null = null
let userId: string | null = null
let started = false

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort stimmt nicht'
  if (/email not confirmed/i.test(message)) return 'Die E-Mail-Adresse ist noch nicht bestätigt (Link im Postfach)'
  if (/already registered|already been registered/i.test(message)) return 'Dazu gibt es schon ein Konto. Bitte anmelden'
  if (/password should be at least/i.test(message)) return 'Das Passwort braucht mindestens 6 Zeichen'
  if (/signups not allowed|signup is disabled/i.test(message)) return 'Neue Konten sind in Supabase deaktiviert'
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'Keine Verbindung zu Supabase'
  return message
}

function setUser(id: string | null, email: string | null) {
  userId = id
  update({ email })
  if (id) engine?.start()
  else engine?.stop()
}

// Verbindet sich mit Supabase, sobald Zugangsdaten vorhanden sind. expectedStores: alle Sammlungen, die abgeglichen werden
export async function initSync(expectedStores: string[]) {
  if (started) return
  started = true
  const cfg = getConfig()
  if (!cfg) {
    update({ configured: false, ready: true })
    return
  }
  update({ configured: true })
  try {
    client = await connect(cfg)
    engine = new SyncEngine(supabaseRemote(client, () => userId), expectedStores)
    engine.subscribe(() => update({ sync: { ...engine!.state } }))
    client.auth.onAuthStateChange((_event, session) => setUser(session?.user.id ?? null, session?.user.email ?? null))
    const { data } = await client.auth.getSession()
    setUser(data.session?.user.id ?? null, data.session?.user.email ?? null)
  } catch (e) {
    update({ setupError: translate(e instanceof Error ? e.message : String(e)) })
  }
  update({ ready: true })
}

export async function signIn(email: string, password: string) {
  if (!client) throw new Error('Nicht verbunden')
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(translate(error.message))
}

// Gibt true zurück, wenn sofort angemeldet; false, wenn zuerst die E-Mail bestätigt werden muss
export async function signUp(email: string, password: string) {
  if (!client) throw new Error('Nicht verbunden')
  const { data, error } = await client.auth.signUp({ email: email.trim(), password })
  if (error) throw new Error(translate(error.message))
  return !!data.session
}

export async function signOut() {
  await client?.auth.signOut()
}

export function syncNow() {
  void engine?.run()
}

export function pendingCount() {
  return engine?.countPending() ?? 0
}

// Aufräumen darf nur laufen, wenn kein Abgleich aussteht: sonst könnten noch nicht empfangene Einträge fehlen
export function canCleanup() {
  if (!snapshot.configured || !userId) return true
  return engine?.isSettled() ?? false
}
