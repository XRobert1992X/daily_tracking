import type { SupabaseClient } from '@supabase/supabase-js'
import type { PulledRow, PushRow, Remote } from './engine'

export interface SyncConfig {
  url: string
  key: string
}

export async function connect(cfg: SyncConfig): Promise<SupabaseClient> {
  // Wird erst geladen, wenn die Synchronisation eingerichtet ist
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'progress:sb-auth',
    },
  })
}

interface DbRow {
  store: string
  id: string
  u: number
  deleted: boolean
  data: unknown
  synced_at: string
}

export function supabaseRemote(client: SupabaseClient, userId: () => string | null): Remote {
  const path = (id: string) => `${userId()}/${id}`
  return {
    userId,
    async pull(since, offset, limit) {
      const { data, error } = await client
        .from('records')
        .select('store,id,u,deleted,data,synced_at')
        .gt('synced_at', since)
        .order('synced_at', { ascending: true })
        .order('store', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1)
      if (error) throw new Error(error.message)
      return (data as DbRow[]).map(
        (r): PulledRow => ({
          store: r.store,
          id: r.id,
          u: Number(r.u),
          deleted: r.deleted,
          data: r.data,
          syncedAt: r.synced_at,
        }),
      )
    },
    async push(rows: PushRow[]) {
      const uid = userId()
      if (!uid) throw new Error('Nicht angemeldet')
      const { error } = await client.from('records').upsert(
        rows.map((r) => ({ user_id: uid, store: r.store, id: r.id, u: r.u, deleted: r.deleted, data: r.data })),
        { onConflict: 'user_id,store,id' },
      )
      if (error) throw new Error(error.message)
    },
    async uploadBlob(id, blob) {
      const { error } = await client.storage
        .from('photos')
        .upload(path(id), blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
      if (error) throw new Error(error.message)
    },
    async downloadBlob(id) {
      const { data, error } = await client.storage.from('photos').download(path(id))
      return error ? null : data
    },
    async removeBlobs(ids) {
      const { error } = await client.storage.from('photos').remove(ids.map(path))
      if (error) throw new Error(error.message)
    },
  }
}
