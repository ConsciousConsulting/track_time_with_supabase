/**
 * Live elapsed seconds for the active timer entry.
 */
import { useEffect, useState } from 'react'
import { durationSeconds } from '../lib/format'

export function useElapsedSeconds(startedAt: string | null, isRunning: boolean): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt || !isRunning) {
      setElapsed(startedAt ? durationSeconds(startedAt, null) : 0)
      return
    }

    const tick = () => setElapsed(durationSeconds(startedAt, null))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt, isRunning])

  return elapsed
}
