import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useCollection } from './storage'
import type { Collection } from './storage'
import type { PenaltyLog } from './types'

const PenaltyContext = createContext<Collection<PenaltyLog> | null>(null)

// Hält die erledigten Strafen, damit Ziel-Karten sie überall abhaken können
export function PenaltyProvider({ children }: { children: ReactNode }) {
  const collection = useCollection<PenaltyLog>('penalties')
  return <PenaltyContext.Provider value={collection}>{children}</PenaltyContext.Provider>
}

export function usePenalties() {
  const c = useContext(PenaltyContext)
  if (!c) throw new Error('PenaltyProvider fehlt')
  return c
}
