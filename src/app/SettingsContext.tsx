import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadSettings, saveSettings } from '@/db/database'
import { DEFAULT_SETTINGS, type Settings } from '@/models'
import { DEFAULT_THEME_ID, applyAppearance } from './themes'

interface SettingsContextValue {
  settings: Settings
  /** True until the stored settings have been read from IndexedDB. */
  ready: boolean
  update: (patch: Partial<Settings>) => Promise<void>
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const loaded = await loadSettings()
    setSettings(loaded)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // The stored choice wins over whatever the first paint guessed from
  // localStorage, and every change lands on the page the moment it is saved.
  useEffect(() => {
    if (!ready) return
    applyAppearance({ theme: settings.theme ?? DEFAULT_THEME_ID, scheme: settings.colorScheme ?? 'auto' })
  }, [ready, settings.theme, settings.colorScheme])

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch)
    setSettings(next)
  }, [])

  const value = useMemo(
    () => ({ settings, ready, update, reload }),
    [settings, ready, update, reload],
  )

  return <SettingsContext value={value}>{children}</SettingsContext>
}

export function useSettings(): SettingsContextValue {
  const ctx = use(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
