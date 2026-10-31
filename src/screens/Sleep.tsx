import { useState } from 'react'
import { Attach } from '../components/Attach'
import { TargetBars } from '../components/charts'
import GoalsPanel from '../components/GoalsPanel'
import { DayNav, Header, Meter, Seg, Stat } from '../components/ui'
import type { AppData } from '../goals'
import {
  bedDiff,
  durationMin,
  entryDayForBedNow,
  fmtDiff,
  fmtDur,
  fmtTime,
  hhmmOf,
  isoFor,
  sleepGoalMin,
  wakeDiff,
} from '../sleep'
import { monthKeys, sum, todayKey, weekKeys } from '../stats'
import type { Goal, SleepCfg, SleepEntry } from '../types'

interface Props {
  data: AppData
  goals: Goal[]
  onCfg: (c: SleepCfg) => void
  onUpsertGoal: (g: Goal) => void
  onRemoveGoal: (id: string) => void
  onSave: (e: SleepEntry) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const QUALITY_WORDS = ['schlecht', 'unruhig', 'okay', 'gut', 'erholsam']

export default function Sleep(props: Props) {
  const { data, goals, onBack } = props
  const [tab, setTab] = useState<'tag' | 'verlauf' | 'ziele'>('tag')

  return (
    <main className="app">
      <Header title="Aufstehen & Schlaf" onBack={onBack} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { id: 'tag', label: 'Tag' },
          { id: 'verlauf', label: 'Verlauf' },
          { id: 'ziele', label: 'Ziele' },
        ]}
      />
      {tab === 'tag' && <DayView {...props} />}
      {tab === 'verlauf' && <History data={data} />}
      {tab === 'ziele' && (
        <GoalsPanel
          topic="sleep"
          data={data}
          goals={goals}
          onUpsert={props.onUpsertGoal}
          onRemove={props.onRemoveGoal}
        />
      )}
    </main>
  )
}

function DiffChip({ min }: { min: number | null }) {
  if (min === null) return null
  return <span className={`diff ${min <= 0 ? 'ok' : 'bad'}`}>{fmtDiff(min)}</span>
}

function DayView({ data, onCfg, onSave, onDelete }: Props) {
  const today = todayKey()
  const [day, setDay] = useState(today)
  const cfg = data.sleepCfg
  const entry = data.sleep.find((e) => e.day === day)
  const [noteDraft, setNoteDraft] = useState<{ day: string; text: string } | null>(null)
  const note = noteDraft?.day === day ? noteDraft.text : (entry?.note ?? '')

  // Speichert Felder des Eintrags; ein komplett leerer Eintrag wird entfernt
  const save = (patch: Partial<SleepEntry>, forDay = day) => {
    const cur = data.sleep.find((e) => e.day === forDay)
    const next: SleepEntry = { ...(cur ?? { id: `sleep-${forDay}`, day: forDay }), ...patch }
    if (!next.bed && !next.wake && !next.quality && !next.note) {
      if (cur) onDelete(cur.id)
      return
    }
    onSave(next)
  }

  const setTime = (kind: 'wake' | 'bed', v: string) =>
    save({ [kind]: v ? isoFor(day, v, kind) : undefined })

  const nightDay = entryDayForBedNow()
  const nightEntry = data.sleep.find((e) => e.day === nightDay)
  const dur = entry ? durationMin(entry) : null
  const goalMin = sleepGoalMin(cfg)

  return (
    <>
      <DayNav day={day} onChange={setDay} />

      <section className="card">
        <p className="muted">Aufstehen</p>
        <div className="timegrid">
          <label className="field">
            <span className="muted">Ziel</span>
            <input
              type="time"
              value={cfg.wake}
              onChange={(e) => e.target.value && onCfg({ ...cfg, wake: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="muted">Aufgestanden</span>
            <input
              type="time"
              value={entry?.wake ? hhmmOf(entry.wake) : ''}
              onChange={(e) => setTime('wake', e.target.value)}
            />
          </label>
        </div>
        {entry?.wake && (
          <p className="timeresult">
            <b>{fmtTime(entry.wake)}</b> Uhr <DiffChip min={wakeDiff(entry, cfg)} />
          </p>
        )}
        {day === today && !entry?.wake && (
          <button className="cta spaced" onClick={() => save({ wake: new Date().toISOString() })}>
            Jetzt aufgestanden
          </button>
        )}
      </section>

      <section className="card">
        <p className="muted">Schlaf (Nacht vor diesem Tag)</p>
        <div className="timegrid">
          <label className="field">
            <span className="muted">Ins Bett</span>
            <input
              type="time"
              value={entry?.bed ? hhmmOf(entry.bed) : ''}
              onChange={(e) => setTime('bed', e.target.value)}
            />
          </label>
          <div className="field">
            <span className="muted">Schlafdauer</span>
            <div className="durbox">
              {dur !== null ? <b>{fmtDur(dur)}</b> : <span className="muted">–</span>}
            </div>
          </div>
        </div>
        {entry?.bed && (
          <p className="timeresult">
            Im Bett um <b>{fmtTime(entry.bed)}</b> Uhr <DiffChip min={bedDiff(entry, cfg)} />
            {dur !== null && (
              <span className={`diff ${dur >= goalMin ? 'ok' : 'bad'}`}>
                {dur >= goalMin
                  ? 'Ziel erreicht'
                  : goalMin - dur < 60
                    ? `${Math.round(goalMin - dur)} min zu wenig`
                    : `${fmtDur(goalMin - dur)} zu wenig`}
              </span>
            )}
          </p>
        )}
        <div className="scale-wrap">
          <Meter
            value={entry?.quality ?? 0}
            max={5}
            onChange={(q) => save({ quality: q || undefined })}
          />
          <div className="scale-read">
            <b>
              {entry?.quality ?? '–'}
              <small>/5</small>
            </b>
            <small className="muted">
              {entry?.quality ? QUALITY_WORDS[entry.quality - 1] : 'Schlafqualität'}
            </small>
          </div>
        </div>
        <label className="field spaced">
          <span className="muted">Notiz (optional)</span>
          <input
            type="text"
            value={note}
            placeholder="z. B. spät gegessen, Wecker verschlafen"
            onChange={(e) => setNoteDraft({ day, text: e.target.value })}
            onBlur={() => {
              if (noteDraft?.day === day) {
                save({ note: noteDraft.text.trim() || undefined })
                setNoteDraft(null)
              }
            }}
          />
        </label>
        {entry && <Attach ownerId={entry.id} />}
      </section>

      {day === today && (
        <section className="card">
          <p className="muted">Heute Nacht</p>
          <div className="timegrid">
            <label className="field">
              <span className="muted">Ziel Zubettgehen</span>
              <input
                type="time"
                value={cfg.bed}
                onChange={(e) => e.target.value && onCfg({ ...cfg, bed: e.target.value })}
              />
            </label>
            <div className="field">
              <span className="muted">Geplante Schlafdauer</span>
              <div className="durbox">
                <b>{fmtDur(goalMin)}</b>
              </div>
            </div>
          </div>
          {nightEntry?.bed ? (
            <p className="timeresult">
              Im Bett seit <b>{fmtTime(nightEntry.bed)}</b> Uhr <DiffChip min={bedDiff(nightEntry, cfg)} />
              <button className="x" aria-label="Zeit löschen" onClick={() => save({ bed: undefined }, nightDay)}>
                ✕
              </button>
            </p>
          ) : (
            <button className="cta spaced" onClick={() => save({ bed: new Date().toISOString() }, nightDay)}>
              Jetzt ins Bett
            </button>
          )}
          <p className="hint">Die Zeit wird morgen beim Aufstehen mit der Schlafdauer verrechnet.</p>
        </section>
      )}
    </>
  )
}

function History({ data }: { data: AppData }) {
  const [range, setRange] = useState<'woche' | 'monat'>('woche')
  const cfg = data.sleepCfg
  const days = range === 'woche' ? weekKeys() : monthKeys()
  const today = todayKey()
  const byDay = new Map(data.sleep.map((e) => [e.day, e]))
  const label = (k: string, i: number) =>
    range === 'woche' ? ['M', 'D', 'M', 'D', 'F', 'S', 'S'][i] : String(new Date(`${k}T12:00:00`).getDate())

  const past = days.filter((k) => k <= today).map((k) => byDay.get(k))
  const durs = past.map((e) => (e ? durationMin(e) : null)).filter((v): v is number => v !== null)
  const wakes = past.map((e) => (e ? wakeDiff(e, cfg) : null)).filter((v): v is number => v !== null)
  const beds = past.map((e) => (e ? bedDiff(e, cfg) : null)).filter((v): v is number => v !== null)
  const okWake = wakes.filter((d) => d <= 0).length
  const okBed = beds.filter((d) => d <= 0).length
  const goalH = sleepGoalMin(cfg) / 60
  const h1 = (v: number) => v.toFixed(1).replace('.', ',')

  const listDays = days.filter((k) => k <= today && byDay.has(k)).reverse()

  return (
    <>
      <Seg
        value={range}
        onChange={setRange}
        options={[
          { id: 'woche', label: 'Woche' },
          { id: 'monat', label: 'Monat' },
        ]}
      />
      <div className="stats">
        <Stat label="Ø Schlaf" value={durs.length ? `${h1(sum(durs) / durs.length / 60)} h` : '–'} />
        <Stat label="Pünktlich auf" value={wakes.length ? `${okWake}/${wakes.length}` : '–'} />
        <Stat label="Pünktlich Bett" value={beds.length ? `${okBed}/${beds.length}` : '–'} />
      </div>

      <section className="card">
        <p className="muted">Schlafdauer (Stunden)</p>
        <TargetBars
          fmt={h1}
          target={goalH}
          data={days.map((k, i) => {
            const e = byDay.get(k)
            const d = e ? durationMin(e) : null
            return { key: k, value: d === null ? 0 : d / 60, label: label(k, i) }
          })}
        />
      </section>

      <section className="card">
        <p className="muted">Aufstehen: früher (grün) oder später (orange) als Ziel, in Minuten</p>
        <TargetBars
          signed
          data={days.map((k, i) => {
            const e = byDay.get(k)
            const d = e ? wakeDiff(e, cfg) : null
            return { key: k, value: d === null ? 0 : -d, label: label(k, i) }
          })}
        />
      </section>

      <section className="card">
        <p className="muted">Zubettgehen: früher (grün) oder später (orange) als Ziel, in Minuten</p>
        <TargetBars
          signed
          data={days.map((k, i) => {
            const e = byDay.get(k)
            const d = e ? bedDiff(e, cfg) : null
            return { key: k, value: d === null ? 0 : -d, label: label(k, i) }
          })}
        />
      </section>

      <section className="card tight">
        <p className="muted">Tage</p>
        {listDays.length === 0 && <p className="hint">Noch keine Einträge in diesem Zeitraum.</p>}
        <ul className="erows">
          {listDays.map((k) => {
            const e = byDay.get(k)!
            const d = durationMin(e)
            return (
              <li key={k}>
                <div className="erow static">
                  <span className="emain">
                    <b>
                      {new Date(`${k}T12:00:00`).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </b>
                    <small>
                      {e.bed ? `Bett ${fmtTime(e.bed)}` : 'Bett –'} · {e.wake ? `auf ${fmtTime(e.wake)}` : 'auf –'}
                      {e.quality ? ` · Qualität ${e.quality}/5` : ''}
                    </small>
                  </span>
                  <span className="emeta">
                    <b>{d !== null ? fmtDur(d) : '–'}</b>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
