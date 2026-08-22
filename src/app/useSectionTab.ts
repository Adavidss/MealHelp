import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Which view of a section is open, kept in the address (?tab=…) so it
 * survives a reload, can be linked to, and lets the old standalone routes
 * (/pantry, /history, /collections, /discover) redirect somewhere exact.
 */
export function useSectionTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const current = (tabs as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback

  const setTab = useCallback(
    (tab: T) => {
      const next = new URLSearchParams(params)
      if (tab === fallback) next.delete('tab')
      else next.set('tab', tab)
      setParams(next, { replace: true })
    },
    [params, setParams, fallback],
  )

  return [current, setTab]
}
