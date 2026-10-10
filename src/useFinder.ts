import { useEffect, useState } from 'react'
import type { Constraints, Result, SearchOptions, Spec } from './lib/divider'

export type FinderRequest = { spec: Spec; cons: Constraints; opts: SearchOptions }
export type FinderResponse = { results: Result[] } | { error: string }
export type FinderState = { state: 'pending' } | { state: 'done'; results: Result[] } | { state: 'error'; message: string }

const DEBOUNCE_MS = 150
const TIMEOUT_MS = 60_000

/**
 * Runs the pair search in a Web Worker. Any input change terminates the running worker and starts over;
 * results are tagged with the request they answer, so stale ones are never shown.
 */
export function useFinder(req: FinderRequest | null): FinderState {
  const [answer, setAnswer] = useState<{ key: string; st: FinderState }>({ key: '', st: { state: 'pending' } })
  // Infinity does not survive JSON, so the key spells it out; the request itself is passed through the closure.
  const key = req ? JSON.stringify(req, (_, v: unknown) => (v === Infinity ? 'inf' : v)) : ''

  useEffect(() => {
    if (!req) return
    const w = new Worker(new URL('./finder.worker.ts', import.meta.url), { type: 'module' })
    const done = (st: FinderState) => {
      window.clearTimeout(timer)
      w.terminate()
      setAnswer({ key, st })
    }
    const timer = window.setTimeout(() => done({ state: 'error', message: 'timeout' }), TIMEOUT_MS)
    w.onmessage = (e: MessageEvent<FinderResponse>) =>
      done('results' in e.data ? { state: 'done', results: e.data.results } : { state: 'error', message: e.data.error })
    w.onerror = (e) => done({ state: 'error', message: e.message || 'worker failed' })
    const start = window.setTimeout(() => w.postMessage(req), DEBOUNCE_MS)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(timer)
      w.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every field of `req`.
  }, [key])

  return answer.key === key && key !== '' ? answer.st : { state: 'pending' }
}
