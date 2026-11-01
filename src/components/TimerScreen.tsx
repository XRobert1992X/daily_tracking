import { useEffect, useRef, useState } from 'react'
import { cancelScheduled, ensureGong, isAudioReady, scheduleEndAt } from '../audio'
import { fmtClock } from '../stats'

export interface TimerResult {
  completed: boolean
  actualSec: number
  count: number
}

interface Props {
  title: string
  startedAt: number
  plannedMin: number
  initialCount?: number
  countLabel?: string
  onCount?: (n: number) => void
  strikes?: number
  rest?: boolean
  earlyLabel?: string
  earlyConfirm?: string
  cancelLabel?: string
  cancelConfirm?: string
  onFinish: (r: TimerResult) => void
  onCancel: () => void
}

export default function TimerScreen({
  title,
  startedAt,
  plannedMin,
  initialCount = 0,
  countLabel,
  onCount,
  strikes = 1,
  rest,
  earlyLabel = 'Früher beenden',
  earlyConfirm,
  cancelLabel = 'Abbrechen',
  cancelConfirm,
  onFinish,
  onCancel,
}: Props) {
  const endAt = startedAt + plannedMin * 60_000
  const [now, setNow] = useState(() => Date.now())
  const [count, setCount] = useState(initialCount)
  const [audioOk, setAudioOk] = useState(true)
  const finished = useRef(false)
  const countRef = useRef(count)

  const finish = (completed: boolean) => {
    if (finished.current) return
    finished.current = true
    const end = completed ? endAt : Date.now()
    if (completed && Date.now() - endAt < 60_000) ensureGong(strikes)
    if (!completed) cancelScheduled()
    onFinish({
      completed,
      actualSec: Math.max(1, Math.round((end - startedAt) / 1000)),
      count: countRef.current,
    })
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    if (Date.now() < endAt) {
      scheduleEndAt(endAt, strikes, { title })
    }
    const tick = () => {
      const t = Date.now()
      setNow(t)
      setAudioOk(isAudioReady())
      if (t >= endAt) finishRef.current(true)
    }
    tick()
    const id = setInterval(tick, 250)
    // Nach dem Aufwachen prüfen, ob die geplante Audio-Datei noch läuft
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      tick()
      if (Date.now() < endAt) scheduleEndAt(endAt, strikes, { title })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        // nicht unterstützt
      }
    }
    void request()
    const onVis = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [])

  const tap = () => {
    const next = count + 1
    countRef.current = next
    setCount(next)
    onCount?.(next)
    navigator.vibrate?.(20)
  }

  const total = plannedMin * 60
  const left = Math.max(0, (endAt - now) / 1000)
  const progress = Math.min(1, 1 - left / total)
  const R = 120
  const C = 2 * Math.PI * R

  const ask = (text: string | undefined, run: () => void) => {
    if (!text || confirm(text)) run()
  }

  return (
    <main className={`app session ${rest ? 'rest' : ''}`}>
      <p className="muted center">{title}</p>

      <div className="ring-wrap">
        <svg viewBox="0 0 280 280" className="ring">
          <defs>
            <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="1" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>
          <circle cx="140" cy="140" r={R} className="ring-bg" />
          <circle
            cx="140"
            cy="140"
            r={R}
            className="ring-fg"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
        <div className="ring-text">
          <div className="clock">{fmtClock(left)}</div>
          <small className="muted">{Number.isInteger(plannedMin) ? `von ${plannedMin} Min` : `von ${fmtClock(total)} Min`}</small>
        </div>
      </div>

      {countLabel && (
        <button className="wander" onClick={tap}>
          <span className="wander-count">{count}</span>
          <span>{countLabel}</span>
        </button>
      )}

      {!audioOk && (
        <p className="banner" onClick={() => setAudioOk(isAudioReady())}>
          Ton ist noch aus. Tippe einmal irgendwo auf den Bildschirm, damit der Gong später
          erklingt.
        </p>
      )}

      <div className="row">
        <button className="ghost" onClick={() => ask(earlyConfirm, () => finish(false))}>
          {earlyLabel}
        </button>
        <button
          className="ghost danger"
          onClick={() =>
            ask(cancelConfirm, () => {
              finished.current = true
              cancelScheduled()
              onCancel()
            })
          }
        >
          {cancelLabel}
        </button>
      </div>
    </main>
  )
}
