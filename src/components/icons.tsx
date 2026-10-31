import type { ReactNode } from 'react'
import type { SocialKind, Topic } from '../types'

const GLYPHS: Record<Topic, ReactNode> = {
  meditation: (
    <>
      <path d="M24 11c4.5 5 4.5 13.500 0 20-4.500-6.500-4.500-15 0-20z" />
      <path d="M24 31c-7.500 1-13.500-3-15.500-10 6.500-1 11.500 2 15.500 7.500" />
      <path d="M24 31c7.500 1 13.500-3 15.500-10-6.500-1-11.500 2-15.500 7.500" />
      <path d="M14 37c6 2.500 14 2.500 20 0" />
    </>
  ),
  reading: (
    <>
      <path d="M8 13c5.500-2.500 11-1.500 16 2v21c-5-3.500-10.500-4.500-16-2z" />
      <path d="M40 13c-5.500-2.500-11-1.500-16 2v21c5-3.500 10.500-4.500 16-2z" />
    </>
  ),
  habits: (
    <>
      <circle cx="24" cy="24" r="14" />
      <path d="M17 24.500l5 5 9-10.500" />
    </>
  ),
  mood: (
    <>
      <circle cx="24" cy="24" r="14" />
      <path d="M17.500 28c2.500 3.500 10.500 3.500 13 0" />
      <circle cx="18.500" cy="21" r="1.300" fill="#e4e4e7" stroke="none" />
      <circle cx="29.500" cy="21" r="1.300" fill="#e4e4e7" stroke="none" />
    </>
  ),
  focus: (
    <>
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="7" />
      <circle cx="24" cy="24" r="1.900" fill="#e4e4e7" stroke="none" />
      <path d="M24 6v4M24 38v4M6 24h4M38 24h4" />
    </>
  ),
  social: (
    <>
      <path d="M12 12h24a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H26l-7 6.500V31h-7a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" />
      <circle cx="17" cy="21.500" r="1.500" fill="#e4e4e7" stroke="none" />
      <circle cx="24" cy="21.500" r="1.500" fill="#e4e4e7" stroke="none" />
      <circle cx="31" cy="21.500" r="1.500" fill="#e4e4e7" stroke="none" />
    </>
  ),
}

export function TopicIcon({ topic, size = 52 }: { topic: Topic; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="topic-svg">
      <rect x="0.5" y="0.5" width="47" height="47" rx="13" fill="#141417" stroke="#2a2a30" />
      <g
        transform="translate(4.800 4.800) scale(0.8)"
        fill="none"
        stroke="#e4e4e7"
        strokeWidth="2.200"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[topic]}
      </g>
    </svg>
  )
}

export const KIND_COLORS: Record<SocialKind, string> = {
  indirect: '#e4e4e7',
  approach: '#e4e4e7',
  contact: '#e4e4e7',
  date: '#e4e4e7',
}

const KIND_GLYPHS: Record<SocialKind, ReactNode> = {
  indirect: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  approach: (
    <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  ),
  contact: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.500" />
      <path d="M11 18h2" />
    </>
  ),
  date: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.500" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
}

export function KindIcon({ kind, size = 24 }: { kind: SocialKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={KIND_COLORS[kind]}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {KIND_GLYPHS[kind]}
    </svg>
  )
}
