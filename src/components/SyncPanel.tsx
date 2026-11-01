import { useState } from 'react'
import {
  pendingCount,
  resetConfig,
  saveConfig,
  signIn,
  signOut,
  signUp,
  syncNow,
  useSync,
} from '../sync'

function since(ts: number | null) {
  if (!ts) return 'noch nicht'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'gerade eben'
  if (s < 60) return `vor ${s} Sek`
  if (s < 3600) return `vor ${Math.round(s / 60)} Min`
  return `vor ${Math.round(s / 3600)} Std`
}

export default function SyncPanel() {
  const sync = useSync()
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fn()
      if (typeof r === 'string') setMsg(r)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!sync.ready) {
    return (
      <section className="card">
        <p className="hint">Synchronisation wird geladen…</p>
      </section>
    )
  }

  if (!sync.configured) {
    return (
      <section className="card">
        <p className="muted">Auf allen Geräten gleich</p>
        <p className="hint">
          Verbinde die App mit deinem kostenlosen Supabase-Projekt, dann sind MacBook, iPhone und iPad
          immer auf dem gleichen Stand (Einträge und Fotos).
        </p>
        <label className="field spaced">
          <span className="muted">Project URL</span>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://abcdefgh.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="muted">anon public key</span>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="eyJ…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button className="ghost wide" disabled={busy || !url || !key} onClick={() => run(async () => saveConfig(url, key))}>
          Verbinden
        </button>
        {msg && <p className="hint bad">{msg}</p>}
        <details className="snaps">
          <summary>So richtest du es ein</summary>
          <ol className="steps">
            <li>Auf supabase.com ein kostenloses Konto und ein neues Projekt anlegen.</li>
            <li>
              Im Projekt unter „SQL Editor“ den Inhalt der Datei <code>supabase/schema.sql</code> aus dem
              Repository einfügen und ausführen.
            </li>
            <li>
              Unter „Project Settings → API“ die Project URL und den <code>anon public</code> Key kopieren und
              hier eintragen.
            </li>
            <li>
              Danach hier ein Konto mit E-Mail und Passwort erstellen. Unter „Authentication → Sign In / Providers“
              kannst du „Confirm email“ ausschalten und nach dem Anlegen deines Kontos neue Registrierungen
              sperren.
            </li>
            <li>Auf den anderen Geräten dieselben Werte eintragen und mit demselben Konto anmelden.</li>
          </ol>
        </details>
      </section>
    )
  }

  if (sync.setupError) {
    return (
      <section className="card">
        <p className="hint bad">Verbindung fehlgeschlagen: {sync.setupError}</p>
        <button className="ghost wide" onClick={() => confirm('Zugangsdaten entfernen?') && void resetConfig()}>
          Zugangsdaten ändern
        </button>
      </section>
    )
  }

  if (!sync.email) {
    return (
      <section className="card">
        <p className="muted">Anmelden</p>
        <label className="field spaced">
          <span className="muted">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="muted">Passwort (mind. 6 Zeichen)</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="ghost primary" disabled={busy || !email || !password} onClick={() => run(() => signIn(email, password))}>
            Anmelden
          </button>
          <button
            className="ghost"
            disabled={busy || !email || !password}
            onClick={() =>
              run(async () => {
                const direct = await signUp(email, password)
                return direct ? undefined : 'Bestätigungs-E-Mail verschickt. Bitte den Link öffnen und dann anmelden.'
              })
            }
          >
            Konto erstellen
          </button>
        </div>
        {msg && <p className="hint bad">{msg}</p>}
        <button className="mini-btn" onClick={() => confirm('Verbindungsdaten entfernen?') && void resetConfig()}>
          Verbindungsdaten ändern
        </button>
      </section>
    )
  }

  const { phase, lastSync, error } = sync.sync
  const pending = pendingCount()
  return (
    <section className="card">
      <p className="muted">Angemeldet als {sync.email}</p>
      <p className={`sync-line ${phase === 'error' ? 'bad' : phase === 'syncing' ? '' : 'ok'}`}>
        {phase === 'syncing'
          ? 'Synchronisiere…'
          : phase === 'error'
            ? 'Fehler beim Abgleich'
            : pending > 0
              ? `${pending} Änderungen warten auf den Abgleich`
              : 'Alles synchron'}
      </p>
      <p className="hint">Letzter Abgleich: {since(lastSync)}</p>
      {error && <p className="hint bad">{error}</p>}
      <div className="row">
        <button className="ghost" disabled={phase === 'syncing'} onClick={() => syncNow()}>
          Jetzt abgleichen
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => confirm('Abmelden? Die Daten bleiben auf diesem Gerät.') && void run(signOut)}
        >
          Abmelden
        </button>
      </div>
      {msg && <p className="hint bad">{msg}</p>}
    </section>
  )
}
