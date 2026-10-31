let ctx: AudioContext | null = null
let keepAlive: HTMLAudioElement | null = null
const scheduled: OscillatorNode[] = []

// 1 Sekunde Stille als WAV; hält die Audio-Session in iOS möglichst am Leben
function silentWavUrl() {
  const rate = 8000
  const buf = new ArrayBuffer(44 + rate)
  const v = new DataView(buf)
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + rate, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, rate, true)
  new Uint8Array(buf, 44).fill(128)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

export function unlockAudio() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    void ctx.resume()
    if (!keepAlive) {
      keepAlive = new Audio(silentWavUrl())
      keepAlive.loop = true
    }
    void keepAlive.play().catch(() => {})
  } catch {
    // Audio ist optional
  }
}

export function stopKeepAlive() {
  keepAlive?.pause()
}

export function isAudioReady() {
  return ctx?.state === 'running'
}

export function hasScheduled() {
  return scheduled.length > 0
}

function strike(at: number, gain: number) {
  if (!ctx) return
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, at)
  master.gain.linearRampToValueAtTime(gain, at + 0.01)
  master.gain.exponentialRampToValueAtTime(0.0001, at + 7)
  master.connect(ctx.destination)
  const partials: [number, number][] = [
    [220, 1],
    [606, 0.5],
    [1189, 0.25],
  ]
  for (const [freq, amp] of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = freq
    g.gain.value = amp
    osc.connect(g).connect(master)
    osc.start(at)
    osc.stop(at + 7.2)
    scheduled.push(osc)
  }
}

export function playBowl() {
  if (!ctx) return
  strike(ctx.currentTime, 0.35)
}

// Gong als "Wecker": mehrere Schläge im Abstand von 6 Sekunden
export function scheduleEnd(delaySec: number, strikes = 3) {
  if (!ctx) return
  cancelScheduled()
  const t = ctx.currentTime + Math.max(0, delaySec)
  for (let i = 0; i < strikes; i++) strike(t + i * 6, 0.7)
}

export function cancelScheduled() {
  for (const o of scheduled) {
    try {
      o.stop()
    } catch {
      // bereits gestoppt
    }
  }
  scheduled.length = 0
}
