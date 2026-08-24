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

const LIGHT_DEFAULT_KEY = 'mealhelp.lightDefaultApplied'

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  /**
   * MealHelp used to follow the system, which meant somebody who had chosen a
   * white theme still got a dark kitchen after sunset — the choice looking
   * like it had not stuck. Light is the default now, and this moves the phones
   * that were already installed. Once only, and never over a real choice:
   * tapping "Follow system" afterwards sticks, because the flag is already set.
   */
  const applyLightDefaultOnce = useCallback(async (loaded: Settings) => {
    try {
      if (localStorage.getItem(LIGHT_DEFAULT_KEY)) return loaded
      localStorage.setItem(LIGHT_DEFAULT_KEY, '1')
      if (loaded.colorScheme !== 'auto') return loaded
      return await saveSettings({ colorScheme: 'light' })
    } catch {
      return loaded
    }
  }, [])

  const reload = useCallback(async () => {
    const loaded = await applyLightDefaultOnce(await loadSettings())
    setSettings(loaded)
    setReady(true)
  }, [applyLightDefaultOnce])

  useEffect(() => {
    void reload()
  }, [reload])

  // The stored choice wins over whatever the first paint guessed from
  // localStorage, and every change lands on the page the moment it is saved.
  useEffect(() => {
    if (!ready) return
    applyAppearance({ theme: settings.theme ?? DEFAULT_THEME_ID, scheme: settings.colorScheme ?? 'light' })
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
