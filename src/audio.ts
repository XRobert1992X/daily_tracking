// Ton läuft über ein normales <audio>-Element. iOS pausiert Web Audio (AudioContext)
// bei gesperrtem Display, spielt Audio-Elemente aber weiter. Deshalb wird für jeden
// Timer eine komplette Audio-Datei erzeugt: Start-Klang, Stille, Gong am Ende.

const RATE = 4000 // 16 Bit mono; reicht für die Obertöne des Gongs bis ca. 1,2 kHz
const STRIKE_GAP = 6
const STRIKE_LEN = 7
const MAX_FILE_SEC = 60 * 60 // darüber: Stille-Schleife + Timer statt Riesendatei

let el: HTMLAudioElement | null = null
let unlocked = false
let url: string | null = null
let mode: 'idle' | 'file' | 'fallback' = 'idle'
let scheduledEnd = 0
let gongAtSec = 0
let fallbackTimer: ReturnType<typeof setTimeout> | undefined
let plan: { endAtMs: number; strikes: number; opts: PlanOpts } | null = null

interface PlanOpts {
  title?: string
}

const PARTIALS: [number, number][] = [
  [220, 1],
  [606, 0.5],
  [1189, 0.25],
]
const PARTIAL_SUM = 1.75

function wavBuffer(seconds: number) {
  const n = Math.max(1, Math.ceil(seconds * RATE))
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, n * 2, true)
  return { buf, pcm: new Int16Array(buf, 44) }
}

function addStrike(pcm: Int16Array, startSec: number, gain: number) {
  const start = Math.floor(startSec * RATE)
  const len = Math.min(STRIKE_LEN * RATE, pcm.length - start)
  const decay = Math.log(10_000) / STRIKE_LEN
  for (let i = 0; i < len; i++) {
    const t = i / RATE
    let s = 0
    for (const [f, a] of PARTIALS) s += a * Math.sin(2 * Math.PI * f * t)
    const env = Math.min(1, t / 0.01) * Math.exp(-decay * t)
    const out = pcm[start + i] + (s / PARTIAL_SUM) * env * gain * 30_000
    pcm[start + i] = Math.max(-32768, Math.min(32767, out))
  }
}

function setSource(blobBuf: ArrayBuffer) {
  if (url) URL.revokeObjectURL(url)
  url = URL.createObjectURL(new Blob([blobBuf], { type: 'audio/wav' }))
  return url
}

function play(loop: boolean) {
  if (!el) return
  el.loop = loop
  el.play()
    .then(() => {
      unlocked = true
    })
    .catch((e: unknown) => {
      // Ein neuer Start unterbricht den alten; das ist kein Fehler
      if ((e as DOMException)?.name !== 'AbortError') unlocked = false
    })
}

function silentSource() {
  return setSource(wavBuffer(1).buf)
}

// Muss in einer Nutzergeste (Tippen) aufgerufen werden
export function unlockAudio() {
  try {
    el ??= new Audio()
    // Läuft ein geplanter Timer ohne Ton (z. B. nach Neuladen), wird er jetzt gestartet
    if (plan && plan.endAtMs > Date.now()) {
      if (el.paused) scheduleEndAt(plan.endAtMs, plan.strikes, plan.opts)
      return
    }
    if (mode === 'idle' || el.paused) {
      el.src = silentSource()
      mode = 'idle'
      play(false)
    }
  } catch {
    // Audio ist optional
  }
}

export function isAudioReady() {
  return unlocked
}

function setMediaSession(title: string) {
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Progress' })
      navigator.mediaSession.playbackState = 'playing'
    }
  } catch {
    // optional
  }
}

export function playGongNow(strikes: number) {
  if (!el) return
  const { buf, pcm } = wavBuffer((strikes - 1) * STRIKE_GAP + STRIKE_LEN)
  for (let i = 0; i < strikes; i++) addStrike(pcm, i * STRIKE_GAP, 0.8)
  el.src = setSource(buf)
  mode = 'idle'
  gongAtSec = 0
  play(false)
}

// Plant den Gong für den Zeitpunkt endAtMs. Mehrfaches Aufrufen mit demselben Ziel ist unschädlich.
export function scheduleEndAt(endAtMs: number, strikes: number, opts: PlanOpts = {}) {
  el ??= new Audio()
  plan = { endAtMs, strikes, opts: { title: opts.title } }
  const same = Math.abs(scheduledEnd - endAtMs) < 1500 && mode !== 'idle'
  if (same && !el.paused) return

  clearTimeout(fallbackTimer)
  scheduledEnd = endAtMs
  const delay = Math.max(0, (endAtMs - Date.now()) / 1000)
  setMediaSession(opts.title ?? 'Timer')

  if (delay > MAX_FILE_SEC) {
    el.src = silentSource()
    mode = 'fallback'
    play(true)
    fallbackTimer = setTimeout(() => playGongNow(strikes), delay * 1000)
    return
  }

  const total = delay + (strikes - 1) * STRIKE_GAP + STRIKE_LEN
  const { buf, pcm } = wavBuffer(total)
  for (let i = 0; i < strikes; i++) addStrike(pcm, delay + i * STRIKE_GAP, 0.8)
  el.src = setSource(buf)
  gongAtSec = delay
  mode = 'file'
  play(false)
}

// Fallback, falls die geplante Datei nicht lief (z. B. durch einen Anruf unterbrochen)
export function ensureGong(strikes: number) {
  if (!el) return
  if (mode === 'file' && (el.ended || el.currentTime >= gongAtSec - 0.5)) return
  if (mode === 'file' && !el.paused) return
  playGongNow(strikes)
}

export function cancelScheduled() {
  clearTimeout(fallbackTimer)
  scheduledEnd = 0
  plan = null
  mode = 'idle'
  if (el) {
    el.pause()
    try {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'
    } catch {
      // optional
    }
  }
}
