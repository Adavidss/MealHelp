import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  Lock,
  LockOpen,
  RefreshCw,
  Replace,
  Shuffle,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { getOrCreatePlan, listPlannedMeals, replacePlanMeals } from '@/db/plans'
import { recordPlanned, recordRejection } from '@/db/cookEvents'
import { generateGroceryList } from '@/db/grocery'
import { pantryKeySet } from '@/db/pantry'
import {
  COOKING_METHODS,
  COOKING_METHOD_LABELS,
  DAY_LOADS,
  DAY_LOAD_LABELS,
  VARIETY_LABELS,
  VARIETY_MODES,
  type CookingMethod,
  type DayLoad,
  type PlanningRequest,
  type Recipe,
  type VarietyMode,
} from '@/models'
import {
  generatePlan,
  replaceCookSlot,
  suggestAnother,
  type GeneratedSlot,
} from '@/services/plannerEngine'
import { contextFromRequest } from '@/services/recommendationEngine'
import {
  dayName,
  dayNameShort,
  formatWeekRange,
  monthDay,
  startOfWeek,
  todayISO,
  weekDates,
} from '@/utils/date'
import { Modal } from '@/components/common/Modal'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import { RecipePicker } from '@/features/planner/RecipePicker'
import { StarterRecipesButton } from '@/features/recipes/StarterRecipesButton'
import { PLAN_PRESETS, type PlanPreset } from './planPresets'
import styles from './PlanWizardPage.module.css'

interface Preferences {
  mealsNeeded: number
  targetCookSessions: number
  preferLeftovers: boolean
  preferredMethods: CookingMethod[]
  requiredMethods: CookingMethod[]
  variety: VarietyMode
  usePantryFirst: boolean
  avoidRecentlyCooked: boolean
  servingsPerMeal: number
  dayLoads: Record<string, DayLoad>
  selectedDates: string[]
  useUp: string
  maxActiveTimeMinutes?: number
  preferredEffort?: PlanningRequest['preferredEffort']
  budgetPreference?: PlanningRequest['budgetPreference']
}

/** The saved planning defaults, as a fresh set of preferences for a week. */
function preferencesFromSettings(
  defaults: ReturnType<typeof useSettings>['settings']['planningDefaults'],
  dates: string[],
): Preferences {
  return {
    mealsNeeded: defaults.mealsNeeded,
    targetCookSessions: defaults.targetCookSessions,
    preferLeftovers: defaults.preferLeftovers,
    preferredMethods: defaults.preferredMethods,
    requiredMethods: [],
    variety: defaults.variety,
    usePantryFirst: defaults.usePantryFirst,
    avoidRecentlyCooked: defaults.avoidRecentlyCooked,
    servingsPerMeal: defaults.servingsPerMeal,
    dayLoads: {},
    selectedDates: dates.slice(0, defaults.mealsNeeded),
    useUp: '',
  }
}

/** A preset only changes the constraints it names; everything else stands. */
function applyPreset(current: Preferences, preset: PlanPreset): Preferences {
  return {
    ...current,
    ...preset.patch,
    preferredMethods: preset.patch.preferredMethods ?? current.preferredMethods,
    requiredMethods: preset.patch.requiredMethods ?? current.requiredMethods,
  }
}

export function PlanWizardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings, ready: settingsReady } = useSettings()
  const { toast } = useToast()

  const weekStart =
    searchParams.get('week') ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const mealType = settings.visibleMealTypes[0] ?? 'dinner'

  // Arriving with ?quick=1 (or ?preset=…) means "just plan it": the week is
  // built the moment the library is in, and the form is only a tap away.
  const quick = searchParams.get('quick') === '1'
  const presetId = searchParams.get('preset')

  // Undefined until IndexedDB has answered, so a one-tap plan waits for the
  // real library and pantry rather than planning an empty one.
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  const pantry = useLiveQuery(() => pantryKeySet(), [])

  const [prefs, setPrefs] = useState<Preferences>(() =>
    preferencesFromSettings(settings.planningDefaults, dates),
  )

  const [slots, setSlots] = useState<GeneratedSlot[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [swapping, setSwapping] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  /** Recipes turned down per night with "try another", so they stay gone. */
  const [passedOver, setPassedOver] = useState<Record<string, string[]>>({})
  /** True from arrival until the one-tap plan is on screen. */
  const [quickPending, setQuickPending] = useState(quick || Boolean(presetId))

  // Keep the number of chosen days in step with "how many meals do you need".
  useEffect(() => {
    setPrefs((current) => {
      if (current.selectedDates.length === current.mealsNeeded) return current
      if (current.selectedDates.length > current.mealsNeeded) {
        return {
          ...current,
          selectedDates: current.selectedDates.slice(0, current.mealsNeeded),
        }
      }
      const missing = dates.filter((date) => !current.selectedDates.includes(date))
      return {
        ...current,
        selectedDates: [
          ...current.selectedDates,
          ...missing.slice(0, current.mealsNeeded - current.selectedDates.length),
        ].sort(),
      }
    })
  }, [prefs.mealsNeeded, dates])

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPrefs((current) => ({ ...current, [key]: value }))

  const toggleMethod = (list: 'preferredMethods' | 'requiredMethods', method: CookingMethod) =>
    setPrefs((current) => ({
      ...current,
      [list]: current[list].includes(method)
        ? current[list].filter((m) => m !== method)
        : [...current[list], method],
    }))

  const buildRequest = (
    using: Preferences,
    lockedSlots: GeneratedSlot[] = [],
  ): PlanningRequest => ({
    startDate: weekStart,
    dates: [...using.selectedDates].sort(),
    mealType,
    mealsNeeded: using.selectedDates.length,
    targetCookSessions: using.targetCookSessions,
    preferLeftovers: using.preferLeftovers,
    preferredCookingMethods: using.preferredMethods,
    requiredMethods: using.requiredMethods,
    variety: using.variety,
    usePantryFirst: using.usePantryFirst,
    avoidRecentlyCooked: using.avoidRecentlyCooked,
    servingsPerMeal: using.servingsPerMeal,
    dayLoads: using.dayLoads,
    maxActiveTimeMinutes: using.maxActiveTimeMinutes,
    preferredEffort: using.preferredEffort,
    budgetPreference: using.budgetPreference,
    useUpIngredients: using.useUp
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    lockedMeals: lockedSlots
      .filter((slot) => slot.locked)
      .map((slot) => ({
        id: `locked-${slot.date}`,
        planId: '',
        date: slot.date,
        mealType,
        kind: slot.kind,
        recipeId: slot.recipeId,
        servings: slot.servings,
        locked: true,
        createdAt: '',
        updatedAt: '',
      })),
  })

  const engineContext = {
    pantryKeys: pantry,
    equipmentOwned: settings.equipmentOwned,
    recentlyCookedHardDays: settings.recentlyCookedHardDays,
    recentlyCookedSoftDays: settings.recentlyCookedSoftDays,
  }

  /** Builds the week from `using`, keeping locked nights when asked. */
  const generateWith = (using: Preferences, keepLocked = false) => {
    const request = buildRequest(using, keepLocked ? (slots ?? []) : [])
    const result = generatePlan({ request, library: recipes ?? [], context: engineContext })
    setSlots(result.slots)
    setWarnings(result.warnings)
    setPassedOver({})
  }

  const generate = (keepLocked = false) => generateWith(prefs, keepLocked)

  /** One tap: a preset's constraints on top of your defaults, built at once. */
  const buildFromPreset = (preset?: PlanPreset) => {
    const next = preset ? applyPreset(prefs, preset) : prefs
    setPrefs(next)
    generateWith(next)
  }

  // The one-tap path. Waits for the library and pantry to have loaded and for
  // the saved defaults to be in, then plans exactly once.
  const autoPlanned = useRef(false)
  useEffect(() => {
    if (autoPlanned.current || !(quick || presetId)) return
    if (!settingsReady || !recipes || !pantry || recipes.length === 0) return
    autoPlanned.current = true
    const fresh = preferencesFromSettings(settings.planningDefaults, dates)
    const preset = PLAN_PRESETS.find((candidate) => candidate.id === presetId)
    const next = preset ? applyPreset(fresh, preset) : fresh
    setPrefs(next)
    generateWith(next)
    setQuickPending(false)
    // generateWith closes over the current library and settings by design;
    // this runs once, when they are first all present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, presetId, settingsReady, recipes, pantry])

  const toggleLock = (date: string) => {
    setSlots(
      (current) =>
        current?.map((slot) =>
          slot.date === date ? { ...slot, locked: !slot.locked } : slot,
        ) ?? null,
    )
  }

  const swap = (date: string, recipe: Recipe) => {
    setSlots((current) => {
      if (!current) return current
      const replaced = current.find((slot) => slot.date === date)
      if (replaced?.recipeId && replaced.recipeId !== recipe.id) {
        // Turning a suggestion down is a signal worth remembering.
        void recordRejection(replaced.recipeId)
      }
      return replaceCookSlot(current, date, recipe, prefs.servingsPerMeal, [
        'You picked this one',
      ])
    })
    setSwapping(null)
  }

  /**
   * "Not that one" — the next-best recipe for that night, ranked against the
   * rest of the week as it stands, with everything already turned down for
   * that night kept out of the running.
   */
  const tryAnother = (date: string) => {
    if (!slots) return
    const current = slots.find((slot) => slot.date === date)
    const alreadyPassed = passedOver[date] ?? []
    const suggestion = suggestAnother({
      slots,
      date,
      library: recipes ?? [],
      context: { ...contextFromRequest(buildRequest(prefs), engineContext) },
      perMeal: prefs.servingsPerMeal,
      dayLoad: prefs.dayLoads[date],
      passedOver: new Set(alreadyPassed),
    })
    if (!suggestion) {
      toast(`Nothing else in your library fits ${dayName(date)}.`)
      return
    }
    if (current?.recipeId) {
      void recordRejection(current.recipeId)
      setPassedOver((rest) => ({ ...rest, [date]: [...alreadyPassed, current.recipeId as string] }))
    }
    setSlots(suggestion.slots)
  }

  const accept = async () => {
    if (!slots) return
    setAccepting(true)
    try {
      const plan = await getOrCreatePlan(weekStart)
      const existing = await listPlannedMeals(plan.id)
      const keptDates = new Set(slots.map((slot) => slot.date))

      // Slots the wizard filled replace whatever was on those days; the rest of
      // the week is left exactly as it was.
      const dateToSlotId = new Map<string, string>()
      const meals = slots
        .filter((slot) => !slot.unfilled)
        .map((slot) => {
          dateToSlotId.set(slot.date, slot.date)
          return {
            planId: plan.id,
            date: slot.date,
            mealType,
            kind: slot.kind,
            recipeId: slot.recipeId,
            servings: slot.servings,
            isLeftover: slot.kind === 'leftover',
            reasons: slot.reasons,
          }
        })

      await replacePlanMeals(plan.id, meals, {
        mealType,
        dates: [...keptDates],
      })

      await recordPlanned(
        slots
          .filter((slot) => slot.kind === 'recipe' && slot.recipeId)
          .map((slot) => slot.recipeId as string),
      )

      const savedMeals = await listPlannedMeals(plan.id)
      await generateGroceryList(weekStart, savedMeals, { planId: plan.id })

      toast(
        `Plan accepted — ${existing.length ? 'week updated' : 'week planned'}. Grocery list is ready.`,
        {
          tone: 'success',
          action: { label: 'Grocery', run: () => navigate('/grocery') },
        },
      )
      navigate(`/plan/${weekStart}`)
    } finally {
      setAccepting(false)
    }
  }

  if (recipes && recipes.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="MealHelp needs recipes before it can plan"
          description="Add a few of your own, import one from a website, or start with the recipes MealHelp ships with."
        >
          <StarterRecipesButton />
          <Link to="/import" className="btn btn-secondary">
            Import a recipe
          </Link>
        </EmptyState>
      </div>
    )
  }

  const cookCount = slots?.filter((slot) => slot.kind === 'recipe' && !slot.unfilled).length ?? 0
  const leftoverCount = slots?.filter((slot) => slot.kind === 'leftover').length ?? 0

  return (
    <div className="page">
      <div className={styles.topBar}>
        <Link to={`/plan/${weekStart}`} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to plan
        </Link>
      </div>

      <header className="page-header">
        <div>
          <h1 className="page-title">Plan my week</h1>
          <p className="page-subtitle">{formatWeekRange(weekStart)}</p>
        </div>
      </header>

      {quickPending && !slots ? (
        <div className={styles.building} role="status">
          <Sparkles size={28} aria-hidden="true" />
          <p>Building your week from your recipes…</p>
        </div>
      ) : !slots ? (
        <>
          <section>
            <h2 className="section-title">
              Build a week in one tap
              <span className="text-sm faint">You can still change anything after</span>
            </h2>
            <div className={styles.presets}>
              <button
                type="button"
                className={`${styles.preset} ${styles.presetQuick}`}
                onClick={() => buildFromPreset()}
              >
                <strong>
                  <Zap size={15} aria-hidden="true" /> Just plan it
                </strong>
                <small>
                  {prefs.mealsNeeded} dinners, cook {prefs.targetCookSessions}× — your usual
                </small>
              </button>
              {PLAN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.preset}
                  onClick={() => buildFromPreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>
          </section>

          <h2 className={`section-title ${styles.customiseTitle}`}>
            Or set it up yourself
          </h2>

          <section>
            <h2 className="section-title">How many meals?</h2>
            <div className="field">
              <span className="field-label">Meals needed</span>
              <div className="row-tight">
                {[3, 4, 5, 6, 7].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className="chip chip-button"
                    aria-pressed={prefs.mealsNeeded === count}
                    onClick={() => set('mealsNeeded', count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Nights you want to cook</span>
              <div className="row-tight">
                {[1, 2, 3, 4, 5, 6, 7]
                  .filter((count) => count <= prefs.mealsNeeded)
                  .map((count) => (
                    <button
                      key={count}
                      type="button"
                      className="chip chip-button"
                      aria-pressed={prefs.targetCookSessions === count}
                      onClick={() => set('targetCookSessions', count)}
                    >
                      {count}
                    </button>
                  ))}
              </div>
              <span className="field-hint">
                {prefs.mealsNeeded > prefs.targetCookSessions
                  ? `${prefs.mealsNeeded - prefs.targetCookSessions} night${
                      prefs.mealsNeeded - prefs.targetCookSessions === 1 ? '' : 's'
                    } will be leftovers from the meals you cook.`
                  : 'You will cook every night.'}
              </span>
            </div>

            <div className="field">
              <span className="field-label">People per meal</span>
              <div className="row-tight">
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className="chip chip-button"
                    aria-pressed={prefs.servingsPerMeal === count}
                    onClick={() => set('servingsPerMeal', count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="section-title">Which days</h2>
            <div className={styles.days}>
              {dates.map((date) => {
                const selected = prefs.selectedDates.includes(date)
                return (
                  <div key={date} className={styles.dayColumn}>
                    <button
                      type="button"
                      className={`${styles.dayToggle} ${selected ? styles.dayOn : ''}`}
                      aria-pressed={selected}
                      onClick={() =>
                        set(
                          'selectedDates',
                          selected
                            ? prefs.selectedDates.filter((d) => d !== date)
                            : [...prefs.selectedDates, date].sort(),
                        )
                      }
                    >
                      <strong>{dayNameShort(date)}</strong>
                      <small>{monthDay(date)}</small>
                    </button>
                    <select
                      className={`select ${styles.loadSelect}`}
                      value={prefs.dayLoads[date] ?? 'normal'}
                      onChange={(event) =>
                        set('dayLoads', {
                          ...prefs.dayLoads,
                          [date]: event.target.value as DayLoad,
                        })
                      }
                      disabled={!selected}
                      aria-label={`How busy is ${dayName(date)}?`}
                    >
                      {DAY_LOADS.map((load) => (
                        <option key={load} value={load}>
                          {DAY_LOAD_LABELS[load]}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="section-title">What kind of week</h2>

            <div className="field">
              <span className="field-label">Lean towards</span>
              <div className="row-tight">
                {COOKING_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    className="chip chip-button"
                    aria-pressed={prefs.preferredMethods.includes(method)}
                    onClick={() => toggleMethod('preferredMethods', method)}
                  >
                    {COOKING_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Must include at least one</span>
              <div className="row-tight">
                {(['slow-cooker', 'instant-pot', 'one-pot', 'sheet-pan', 'no-cook'] as CookingMethod[]).map(
                  (method) => (
                    <button
                      key={method}
                      type="button"
                      className="chip chip-button"
                      aria-pressed={prefs.requiredMethods.includes(method)}
                      onClick={() => toggleMethod('requiredMethods', method)}
                    >
                      {COOKING_METHOD_LABELS[method]}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Variety</span>
              <div className="row-tight">
                {VARIETY_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="chip chip-button"
                    aria-pressed={prefs.variety === mode}
                    onClick={() => set('variety', mode)}
                  >
                    {VARIETY_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="use-up">
                Anything to use up?
              </label>
              <input
                id="use-up"
                className="input"
                value={prefs.useUp}
                onChange={(event) => set('useUp', event.target.value)}
                placeholder="spinach, ground beef"
              />
              <span className="field-hint">Separate with commas.</span>
            </div>

            <div className="field">
              <span className="field-label">Also</span>
              <div className="row-tight">
                <button
                  type="button"
                  className="chip chip-button"
                  aria-pressed={prefs.preferLeftovers}
                  onClick={() => set('preferLeftovers', !prefs.preferLeftovers)}
                >
                  Plan for leftovers
                </button>
                <button
                  type="button"
                  className="chip chip-button"
                  aria-pressed={prefs.usePantryFirst}
                  onClick={() => set('usePantryFirst', !prefs.usePantryFirst)}
                >
                  Use the pantry first
                </button>
                <button
                  type="button"
                  className="chip chip-button"
                  aria-pressed={prefs.avoidRecentlyCooked}
                  onClick={() => set('avoidRecentlyCooked', !prefs.avoidRecentlyCooked)}
                >
                  Avoid what I just ate
                </button>
              </div>
            </div>
          </section>

          <div className={styles.footer}>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => generate(false)}
              disabled={prefs.selectedDates.length === 0}
            >
              <Sparkles size={19} aria-hidden="true" />
              Build my week
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.summary}>
            <p>
              <strong>
                {cookCount} cooking session{cookCount === 1 ? '' : 's'}
              </strong>
              {leftoverCount
                ? ` · ${leftoverCount} leftover night${leftoverCount === 1 ? '' : 's'}`
                : ''}
            </p>
            <p className="text-sm muted">
              Nothing is saved until you accept the plan.
            </p>
          </div>

          {warnings.map((warning) => (
            <p key={warning} className={styles.warning}>
              {warning}
            </p>
          ))}

          <ul className={styles.slots}>
            {slots.map((slot) => (
              <li
                key={slot.date}
                className={`${styles.slot} ${slot.kind === 'leftover' ? styles.leftoverSlot : ''}`}
              >
                <div className={styles.slotDay}>
                  <strong>{dayName(slot.date)}</strong>
                  <small>{monthDay(slot.date)}</small>
                </div>

                <div className={styles.slotBody}>
                  {slot.unfilled ? (
                    <p className={styles.unfilled}>Nothing fit this day</p>
                  ) : (
                    <>
                      <p className={styles.slotTitle}>
                        {slot.recipe?.title ?? 'Meal'}
                        {slot.kind === 'leftover' ? ' — leftovers' : ''}
                      </p>
                      {slot.kind === 'recipe' && slot.servings ? (
                        <p className={styles.slotMeta}>Cook {slot.servings} servings</p>
                      ) : null}
                      {slot.reasons.length ? (
                        <ul className={styles.reasons}>
                          {slot.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </div>

                <div className={styles.slotActions}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => toggleLock(slot.date)}
                    aria-pressed={Boolean(slot.locked)}
                    aria-label={slot.locked ? 'Unlock this meal' : 'Lock this meal'}
                  >
                    {slot.locked ? (
                      <Lock size={17} aria-hidden="true" />
                    ) : (
                      <LockOpen size={17} aria-hidden="true" />
                    )}
                  </button>
                  {slot.kind === 'recipe' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => tryAnother(slot.date)}
                      disabled={Boolean(slot.locked)}
                      aria-label="Try another suggestion for this night"
                      title="Try another"
                    >
                      <Shuffle size={17} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setSwapping(slot.date)}
                    aria-label="Replace this meal with one you choose"
                    title="Choose a recipe"
                  >
                    <Replace size={17} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.previewActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => generate(true)}
            >
              <RefreshCw size={17} aria-hidden="true" />
              Regenerate
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSlots(null)}>
              Change preferences
            </button>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => void accept()}
              disabled={accepting}
            >
              {accepting ? 'Saving…' : 'Accept plan'}
            </button>
          </div>

          <Modal
            open={Boolean(swapping)}
            title="Replace with"
            onClose={() => setSwapping(null)}
          >
            <RecipePicker
              mealType={mealType}
              excludeIds={slots
                .map((slot) => slot.recipeId)
                .filter((id): id is string => Boolean(id))}
              onSelect={(recipe) => swapping && swap(swapping, recipe)}
            />
          </Modal>
        </>
      )}
    </div>
  )
}
