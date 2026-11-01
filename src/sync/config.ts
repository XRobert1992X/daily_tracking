import type { SyncConfig } from './supabase'

// Trage hier die Werte deines Supabase-Projekts ein (Project URL und anon public key).
// Der anon-Key ist öffentlich gedacht; geschützt sind die Daten durch Login und Zeilen-Sicherheit (siehe supabase/schema.sql).
// Alternativ lassen sich beide Werte in der App unter „Synchronisation“ eintragen.
export const DEFAULT_SYNC: SyncConfig = {
  url: '',
  key: '',
}
