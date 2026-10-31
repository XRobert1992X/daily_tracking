import { useEffect, useRef, useState } from 'react'
import {
  cancelScheduled,
  hasScheduled,
  isAudioReady,
  playBowl,
  scheduleEnd,
} from '../audio'
import { saveActive } from '../storage'
import { fmtClock } from '../stats'
import { typeLabel } from '../types'
import type { ActiveSession, FinishedSession } from '../types'

interface Props {
  active: ActiveSession
  onFinish: (r: FinishedSession) => void
  onCancel: () => void
}

export default function SessionScreen({ active, onFinish, onCancel }: Props) {
  const endAt = active.startedAt + active.plannedMin * 60_000
  const [now, setNow] = useState(() => Date.now())
  const [count, setCount] = useState(active.interruptions)
  const [audioOk, setAudioOk] = useState(isAudioReady())
  const finished = useRef(false)
  const countRef = useRef(count)

  const finish = (completed: boolean) => {
    if (finished.current) return
    finished.current = true
    const end = completed ? endAt : Date.now()
    if (completed && !hasScheduled()) scheduleEnd(0)
    if (!completed) cancelScheduled()
    onFinish({
      startedAt: active.startedAt,
      plannedMin: active.plannedMin,
      type: active.type,
      interruptions: countRef.current,
      actualSec: Math.max(1, Math.round((end - active.startedAt) / 1000)),
      completed,
    })
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    saveActive({ ...active, interruptions: countRef.current })
    if (Date.now() < endAt) {
      if (Date.now() - active.startedAt < 3000) playBowl()
      scheduleEnd((endAt - Date.now()) / 1000)
    }
    const tick = () => {
      const t = Date.now()
      setNow(t)
      setAudioOk(isAudioReady())
      if (t >= endAt) finishRef.current(true)
    }
    tick()
    const id = setInterval(tick, 250)
    // Nach dem Aufwachen den Gong neu auf die Restzeit ausrichten
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      tick()
      const left = (endAt - Date.now()) / 1000
      if (left > 0) scheduleEnd(left)
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
    saveActive({ ...active, interruptions: next })
    navigator.vibrate?.(20)
  }

  const total = active.plannedMin * 60
  const left = Math.max(0, (endAt - now) / 1000)
  const progress = Math.min(1, 1 - left / total)
  const R = 120
  const C = 2 * Math.PI * R

  return (
    <main className="app session">
      <p className="muted center">{typeLabel(active.type)}</p>

      <div className="ring-wrap">
        <svg viewBox="0 0 280 280" className="ring">
          <defs>
            <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7c5cff" />
              <stop offset="1" stopColor="#22d3ee" />
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
          <small className="muted">von {active.plannedMin} Min</small>
        </div>
      </div>

      <button className="wander" onClick={tap}>
        <span className="wander-count">{count}</span>
        <span>Abgeschweift · tippen</span>
      </button>

      {!audioOk && (
        <p className="banner" onClick={() => setAudioOk(isAudioReady())}>
          Ton ist noch aus. Tippe einmal irgendwo auf den Bildschirm, damit der Gong
          später erklingt.
        </p>
      )}

      <div className="row">
        <button
          className="ghost"
          onClick={() => {
            if (confirm('Meditation vorzeitig beenden und speichern?')) finish(false)
          }}
        >
          Früher beenden
        </button>
        <button
          className="ghost danger"
          onClick={() => {
            if (confirm('Meditation verwerfen? Es wird nichts gespeichert.')) {
              finished.current = true
              cancelScheduled()
              onCancel()
            }
          }}
        >
          Abbrechen
        </button>
      </div>
    </main>
  )
}
