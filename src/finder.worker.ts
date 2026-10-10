import { findPairs } from './lib/divider'
import type { FinderRequest, FinderResponse } from './useFinder'

self.onmessage = (e: MessageEvent<FinderRequest>) => {
  const { spec, cons, opts } = e.data
  let msg: FinderResponse
  try {
    msg = { results: findPairs(spec, cons, opts) }
  } catch (err) {
    msg = { error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(msg)
}
