import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import {
  COMMON_EQUIPMENT,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  VARIETY_LABELS,
  VARIETY_MODES,
  type MealType,
  type VarietyMode,
} from '@/models'
import {
  deleteAllData,
  downloadBackup,
  readBackupFile,
  restoreBackup,
  type RestoreMode,
  type ValidationResult,
} from '@/services/backup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { NUTRIENTS } from '@/models'
import { ThemePicker } from './ThemePicker'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const { settings, update, reload } = useSettings()
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const counts = useLiveQuery(async () => {
    const [recipes, plans, cooks] = await Promise.all([
      db.recipes.count(),
      db.mealPlans.count(),
      db.cookEvents.count(),
    ])
    return { recipes, plans, cooks }
  }, [])

  const [pendingRestore, setPendingRestore] = useState<ValidationResult>()
  const [confirmWipe, setConfirmWipe] = useState(false)

  const toggleMealType = (mealType: MealType) => {
    const current = settings.visibleMealTypes
    const next = current.includes(mealType)
      ? current.filter((type) => type !== mealType)
      : [...MEAL_TYPES.filter((t) => current.includes(t) || t === mealType)]
    void update({ visibleMealTypes: next.length ? next : ['dinner'] })
  }

  const toggleEquipment = (item: string) => {
    const owned = settings.equipmentOwned
    void update({
      equipmentOwned: owned.includes(item)
        ? owned.filter((entry) => entry !== item)
        : [...owned, item],
    })
  }

  const pickBackup = async (file: File) => {
    const result = await readBackupFile(file)
    if (!result.ok) {
      toast(result.errors[0], { tone: 'error' })
      return
    }
    setPendingRestore(result)
  }

  const runRestore = async (mode: RestoreMode) => {
    if (!pendingRestore?.backup) return
    const result = await restoreBackup(pendingRestore.backup, mode)
    setPendingRestore(undefined)
    await reload()
    toast(
      mode === 'replace'
        ? `Replaced everything with the backup (${result.added} records).`
        : `Merged the backup: ${result.added} added, ${result.updated} updated.`,
      { tone: 'success' },
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            {counts
              ? `${counts.recipes} recipes · ${counts.plans} weeks · ${counts.cooks} cook sessions`
              : 'Everything is stored on this device'}
          </p>
        </div>
      </header>

      <section>
        <h2 className="section-title">Appearance</h2>
        <p className="text-sm muted">
          Tap a theme to try it on — it applies straight away and stays.
        </p>
        <ThemePicker />
      </section>

      <section>
        <h2 className="section-title">Planning</h2>

        <div className="field">
          <span className="field-label">Meals you plan</span>
          <div className="row-tight">
            {MEAL_TYPES.map((mealType) => (
              <button
                key={mealType}
                type="button"
                className="chip chip-button"
                aria-pressed={settings.visibleMealTypes.includes(mealType)}
                onClick={() => toggleMealType(mealType)}
              >
                {MEAL_TYPE_LABELS[mealType]}
              </button>
            ))}
          </div>
          <span className="field-hint">
            Hide the ones you never plan and the planner gets much quieter.
          </span>
        </div>

        <div className="field">
          <span className="field-label">Week starts on</span>
          <div className="row-tight">
            <button
              type="button"
              className="chip chip-button"
              aria-pressed={settings.weekStartsOn === 1}
              onClick={() => void update({ weekStartsOn: 1 })}
            >
              Monday
            </button>
            <button
              type="button"
              className="chip chip-button"
              aria-pressed={settings.weekStartsOn === 0}
              onClick={() => void update({ weekStartsOn: 0 })}
            >
              Sunday
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="default-servings">
            People you usually cook for
          </label>
          <input
            id="default-servings"
            type="number"
            className={`input ${styles.narrow}`}
            min="1"
            inputMode="numeric"
            value={settings.defaultServings}
            onChange={(event) =>
              void update({
                defaultServings: Math.max(1, Number(event.target.value) || 1),
                planningDefaults: {
                  ...settings.planningDefaults,
                  servingsPerMeal: Math.max(1, Number(event.target.value) || 1),
                },
              })
            }
          />
        </div>

        <div className="field">
          <span className="field-label">Default variety</span>
          <div className="row-tight">
            {VARIETY_MODES.map((mode: VarietyMode) => (
              <button
                key={mode}
                type="button"
                className="chip chip-button"
                aria-pressed={settings.planningDefaults.variety === mode}
                onClick={() =>
                  void update({
                    planningDefaults: { ...settings.planningDefaults, variety: mode },
                  })
                }
              >
                {VARIETY_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="repeat-days">
            Don't suggest something cooked in the last
          </label>
          <div className="row-tight">
            {[3, 7, 14].map((days) => (
              <button
                key={days}
                type="button"
                className="chip chip-button"
                aria-pressed={settings.recentlyCookedHardDays === days}
                onClick={() => void update({ recentlyCookedHardDays: days })}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Your kitchen</h2>
        <div className="field">
          <span className="field-label">Equipment you own</span>
          <div className="row-tight">
            {COMMON_EQUIPMENT.map((item) => (
              <button
                key={item}
                type="button"
                className="chip chip-button"
                aria-pressed={settings.equipmentOwned.includes(item)}
                onClick={() => toggleEquipment(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="field-hint">
            MealHelp will not suggest a slow cooker recipe if you do not have one.
          </span>
        </div>

        <div className="field">
          <span className="field-label">While cooking</span>
          <button
            type="button"
            className="chip chip-button"
            aria-pressed={settings.keepScreenAwakeWhileCooking}
            onClick={() =>
              void update({
                keepScreenAwakeWhileCooking: !settings.keepScreenAwakeWhileCooking,
              })
            }
          >
            Keep the screen awake
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Finding recipes online</h2>

        <div className="field">
          <label className="field-label" htmlFor="spoonacular">
            Spoonacular key
          </label>
          <input
            id="spoonacular"
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            defaultValue={settings.spoonacularKey ?? ''}
            placeholder="Paste a free key to search far more recipes"
            onBlur={(event) =>
              void update({ spoonacularKey: event.target.value.trim() || undefined })
            }
          />
          <span className="field-hint">
            Without one, Discover searches a free database of a few hundred
            recipes. A free key from{' '}
            <a href="https://spoonacular.com/food-api" target="_blank" rel="noreferrer">
              spoonacular.com
            </a>{' '}
            opens hundreds of thousands, with proper ingredient search. The key
            stays on this device and is only ever sent to Spoonacular.
          </span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="proxy">
            Your own page fetcher
          </label>
          <input
            id="proxy"
            className="input"
            type="url"
            autoComplete="off"
            spellCheck={false}
            defaultValue={settings.importSettings.proxyUrl ?? ''}
            placeholder="https://your-worker.workers.dev/?url={url}"
            onBlur={(event) =>
              void update({
                importSettings: {
                  ...settings.importSettings,
                  proxyUrl: event.target.value.trim() || undefined,
                },
              })
            }
          />
          <span className="field-hint">
            Optional. MealHelp already reads pages through its own fetcher — the
            Worker in the project's <code>worker/</code> folder, run for this
            site. Put yours here to use it instead: it is tried first, and nobody
            else sees the recipes you read.
          </span>
        </div>

        <div className="field">
          <span className="field-label">When importing a link</span>
          <button
            type="button"
            className="chip chip-button"
            aria-pressed={settings.importSettings.useSharedFetchers}
            onClick={() =>
              void update({
                importSettings: {
                  ...settings.importSettings,
                  useSharedFetchers: !settings.importSettings.useSharedFetchers,
                },
              })
            }
          >
            Use shared public fetchers
          </button>
          <span className="field-hint">
            A last resort for when MealHelp's own fetcher cannot help. The trade
            is that the address of the recipe passes through a third party —
            turn this off to keep every request between you, the recipe site
            and MealHelp's fetcher.
          </span>
        </div>
      </section>

      <section>
        <h2 className="section-title">Nutrition targets</h2>
        <p className="text-sm muted">
          What the Nutrition view measures a day against. Blank means the standard
          Daily Value for a 2,000-calorie diet.
        </p>
        <div className={styles.targets}>
          {NUTRIENTS.filter((n) => n.headline || n.key === 'fiber' || n.key === 'sodium').map((nutrient) => (
            <label key={nutrient.key} className={styles.target}>
              <span className="field-label">
                {nutrient.label} <small>({nutrient.unit})</small>
              </span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={String(nutrient.dailyValue)}
                defaultValue={settings.nutritionTargets?.[nutrient.key] ?? ''}
                onBlur={(event) => {
                  const value = Number(event.target.value)
                  void update({
                    nutritionTargets: {
                      ...settings.nutritionTargets,
                      [nutrient.key]: event.target.value.trim() && value > 0 ? value : undefined,
                    },
                  })
                }}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Your data</h2>
        <p className="text-sm muted">
          MealHelp stores everything in this browser. Nothing is uploaded, which
          also means nothing is backed up unless you export it.
        </p>

        <div className={styles.dataActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void downloadBackup()}
          >
            <Download size={17} aria-hidden="true" />
            Export backup
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={17} aria-hidden="true" />
            Import backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pickBackup(file)
              event.target.value = ''
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn-danger btn-sm"
          style={{ marginTop: 'var(--space-4)' }}
          onClick={() => setConfirmWipe(true)}
        >
          Delete everything
        </button>
      </section>

      <Modal
        open={Boolean(pendingRestore?.ok)}
        title="Restore backup"
        onClose={() => setPendingRestore(undefined)}
      >
        <p>
          This backup holds <strong>{pendingRestore?.summary?.total ?? 0}</strong>{' '}
          records
          {pendingRestore?.summary?.exportedAt
            ? `, exported ${new Date(pendingRestore.summary.exportedAt).toLocaleDateString()}`
            : ''}
          .
        </p>
        <ul className={styles.counts}>
          {Object.entries(pendingRestore?.summary?.counts ?? {}).map(([table, count]) => (
            <li key={table}>
              {table}: {count}
            </li>
          ))}
        </ul>

        <div className={styles.restoreChoice}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void runRestore('merge')}
          >
            Merge with what's here
          </button>
          <p className="field-hint">
            Keeps everything you already have and adds what's missing.
          </p>

          <button
            type="button"
            className="btn btn-danger btn-block"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => void runRestore('replace')}
          >
            Replace everything
          </button>
          <p className="field-hint">
            Deletes all current recipes, plans and history first. There is no undo.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmWipe}
        title="Delete everything?"
        message="Every recipe, plan, grocery list and cooking record on this device will be permanently deleted. Export a backup first if there is any chance you want it back."
        confirmLabel="Delete everything"
        danger
        onConfirm={() => {
          void deleteAllData().then(async () => {
            await reload()
            toast('All data deleted.')
          })
          setConfirmWipe(false)
        }}
        onCancel={() => setConfirmWipe(false)}
      />
    </div>
  )
}
