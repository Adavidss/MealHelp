import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Lock, LockOpen, RefreshCw, Replace, Sparkles } from 'lucide-react'
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
import { generatePlan, type GeneratedSlot } from '@/services/plannerEngine'
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
import { PLAN_PRESETS } from './planPresets'
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

export function PlanWizardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { toast } = useToast()

  const weekStart =
    searchParams.get('week') ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const mealType = settings.visibleMealTypes[0] ?? 'dinner'

  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const pantry = useLiveQuery(() => pantryKeySet(), [], new Set<string>())

  const [prefs, setPrefs] = useState<Preferences>(() => ({
    mealsNeeded: settings.planningDefaults.mealsNeeded,
    targetCookSessions: settings.planningDefaults.targetCookSessions,
    preferLeftovers: settings.planningDefaults.preferLeftovers,
    preferredMethods: settings.planningDefaults.preferredMethods,
    requiredMethods: [],
    variety: settings.planningDefaults.variety,
    usePantryFirst: settings.planningDefaults.usePantryFirst,
    avoidRecentlyCooked: settings.planningDefaults.avoidRecentlyCooked,
    servingsPerMeal: settings.planningDefaults.servingsPerMeal,
    dayLoads: {},
    selectedDates: dates.slice(0, settings.planningDefaults.mealsNeeded),
    useUp: '',
  }))

  const [slots, setSlots] = useState<GeneratedSlot[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [swapping, setSwapping] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

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

  const buildRequest = (lockedSlots: GeneratedSlot[] = []): PlanningRequest => ({
    startDate: weekStart,
    dates: [...prefs.selectedDates].sort(),
    mealType,
    mealsNeeded: prefs.selectedDates.length,
    targetCookSessions: prefs.targetCookSessions,
    preferLeftovers: prefs.preferLeftovers,
    preferredCookingMethods: prefs.preferredMethods,
    requiredMethods: prefs.requiredMethods,
    variety: prefs.variety,
    usePantryFirst: prefs.usePantryFirst,
    avoidRecentlyCooked: prefs.avoidRecentlyCooked,
    servingsPerMeal: prefs.servingsPerMeal,
    dayLoads: prefs.dayLoads,
    maxActiveTimeMinutes: prefs.maxActiveTimeMinutes,
    preferredEffort: prefs.preferredEffort,
    budgetPreference: prefs.budgetPreference,
    useUpIngredients: prefs.useUp
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

  const generate = (keepLocked = false) => {
    const request = buildRequest(keepLocked ? (slots ?? []) : [])
    const result = generatePlan({
      request,
      library: recipes ?? [],
      context: {
        pantryKeys: pantry,
        equipmentOwned: settings.equipmentOwned,
        recentlyCookedHardDays: settings.recentlyCookedHardDays,
        recentlyCookedSoftDays: settings.recentlyCookedSoftDays,
      },
    })
    setSlots(result.slots)
    setWarnings(result.warnings)
  }

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
      return current.map((slot) =>
        slot.date === date
          ? {
              ...slot,
              kind: 'recipe',
              recipeId: recipe.id,
              recipe,
              servings: recipe.servings ?? prefs.servingsPerMeal,
              unfilled: false,
              reasons: ['You picked this one'],
            }
          : slot,
      )
    })
    setSwapping(null)
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

      {!slots ? (
        <>
          <section>
            <h2 className="section-title">Start from</h2>
            <div className={styles.presets}>
              {PLAN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.preset}
                  onClick={() =>
                    setPrefs((current) => ({
                      ...current,
                      ...preset.patch,
                      preferredMethods:
                        preset.patch.preferredMethods ?? current.preferredMethods,
                      requiredMethods:
                        preset.patch.requiredMethods ?? current.requiredMethods,
                    }))
                  }
                >
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>
          </section>

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
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setSwapping(slot.date)}
                    aria-label="Replace this meal"
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
