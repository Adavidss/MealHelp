import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ChevronDown,
  Dices,
  ChevronUp,
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
import { saveRecipe } from '@/db/recipes'
import { recordPlanned, recordRejection } from '@/db/cookEvents'
import { generateGroceryList } from '@/db/grocery'
import { pantryKeySet } from '@/db/pantry'
import { loadPriceBook } from '@/db/prices'
import {
  COOKING_METHODS,
  COOKING_METHOD_LABELS,
  DAY_LOADS,
  DAY_LOAD_LABELS,
  VARIETY_LABELS,
  VARIETY_MODES,
  type CookingMethod,
  type DayLoad,
  PLAN_SCOPE_LABELS,
  PLAN_SCOPE_TYPES,
  type PlanScope,
  type PlanningRequest,
  type Recipe,
  type VarietyMode,
} from '@/models'
import { useWebWeek, isProvisional } from './useWebWeek'
import { WeekFitPanel } from './WeekFitPanel'
import {
  weekFit,
  type WeekTargets,
  generateWeek,
  replaceCookSlot,
  suggestAnother,
  type GeneratedSlot,
  type WeekSlotPlan,
} from '@/services/plannerEngine'
import { contextFromRequest } from '@/services/recommendationEngine'
import { weekNeeds, weekQueries } from '@/services/recipeDiscovery'
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
import { MealCard } from '@/components/meal/MealCard'
import { RecipePicker } from '@/features/planner/RecipePicker'
import { RecipePeek } from './RecipePeek'
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
  /** Which meals to fill in — the rest of the day is left as it is. */
  scope: PlanScope
  /** What the week has to fit inside. Any of them may be left unset. */
  budget?: number
  maxMinutesPerMeal?: number
  proteinPerDay?: number
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
    scope: defaults.planScope ?? 'all',
    budget: defaults.weekBudget,
    maxMinutesPerMeal: defaults.maxMinutesPerMeal,
    proteinPerDay: defaults.proteinPerDay,
  }
}

/**
 * Whole weeks, working weeks and weekends.
 *
 * The planner used to default to five meals, which the day grid then filled
 * from Monday — so a weekend was never planned unless you noticed the grid and
 * ticked Saturday yourself. Weekends are when most people actually cook.
 */
const DAY_PRESETS: Array<{ id: string; label: string; pick: (dates: string[]) => string[] }> = [
  { id: 'all', label: 'Whole week', pick: (dates) => [...dates] },
  {
    id: 'weekdays',
    label: 'Weekdays',
    pick: (dates) => dates.filter((date) => ![0, 6].includes(new Date(`${date}T00:00:00`).getDay())),
  },
  {
    id: 'weekend',
    label: 'Weekend',
    pick: (dates) => dates.filter((date) => [0, 6].includes(new Date(`${date}T00:00:00`).getDay())),
  },
]

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
  const { settings, ready: settingsReady, update } = useSettings()
  const { toast } = useToast()

  const weekStart =
    searchParams.get('week') ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const mealSlots = settings.mealSlots
  /** The slots that need a recipe chosen; the rest cost the planner nothing. */
  const cookSlots = mealSlots.filter((slot) => slot.fill === 'cook')

  // Arriving with ?quick=1 (or ?preset=…) means "just plan it": the week is
  // built the moment the library is in, and the form is only a tap away.
  const quick = searchParams.get('quick') === '1'
  const presetId = searchParams.get('preset')

  // Undefined until IndexedDB has answered, so a one-tap plan waits for the
  // real library and pantry rather than planning an empty one.
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])
  // For pricing the week and knowing what is already in the cupboard.
  const pantryItems = useLiveQuery(() => db.pantryItems.toArray(), [], [])
  const ownPrices = useLiveQuery(() => loadPriceBook(), [], new Map())
  const pantry = useLiveQuery(() => pantryKeySet(), [])

  const [prefs, setPrefs] = useState<Preferences>(() =>
    preferencesFromSettings(settings.planningDefaults, dates),
  )

  const [plans, setPlans] = useState<WeekSlotPlan[] | null>(null)
  /** Which meal is open for reading, keyed slot:date. */
  const [peeking, setPeeking] = useState<string>()
  const [warnings, setWarnings] = useState<string[]>([])
  const [swapping, setSwapping] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  /** Recipes turned down per night with "try another", so they stay gone. */
  const [passedOver, setPassedOver] = useState<Record<string, string[]>>({})
  /** True from arrival until the one-tap plan is on screen. */
  const [quickPending, setQuickPending] = useState(quick || Boolean(presetId))
  /** Recipes fetched for a surprise week: not saved until the plan is. */
  const [fromWeb, setFromWeb] = useState<Recipe[]>([])

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
    mealType: cookSlots[0]?.type ?? 'dinner',
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
        mealType: cookSlots[0]?.type ?? 'dinner',
        kind: slot.kind === 'custom' ? 'custom' : slot.kind,
        recipeId: slot.recipeId,
        servings: slot.servings,
        locked: true,
        createdAt: '',
        updatedAt: '',
      })),
  })

  const webWeek = useWebWeek(
    useMemo(() => ({ spoonacularKey: settings.spoonacularKey?.trim() }), [settings.spoonacularKey]),
  )

  const targets: WeekTargets = {
    budget: prefs.budget,
    maxMinutesPerMeal: prefs.maxMinutesPerMeal,
    proteinPerDay: prefs.proteinPerDay,
  }

  const fit = useMemo(
    () =>
      plans
        ? weekFit({
            slots: plans.flatMap((plan) => plan.meals),
            pantry: pantryItems ?? [],
            ownPrices: ownPrices ?? new Map(),
            targets,
            dayCount: new Set(plans.flatMap((plan) => plan.meals.map((meal) => meal.date))).size,
            // The standing meals have no recipe, so their numbers come from
            // the slot that defines them — the same ones the nutrition page uses.
            standingMeals: plans
              .filter((plan) => plan.slot.fill === 'routine' && plan.slot.routine?.nutrition)
              .map((plan) => ({
                nutrition: plan.slot.routine!.nutrition!,
                count: plan.meals.filter((meal) => !meal.unfilled).length,
              })),
          })
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, pantryItems, ownPrices, prefs.budget, prefs.maxMinutesPerMeal, prefs.proteinPerDay],
  )

  const engineContext = {
    pantryKeys: pantry,
    equipmentOwned: settings.equipmentOwned,
    recentlyCookedHardDays: settings.recentlyCookedHardDays,
    recentlyCookedSoftDays: settings.recentlyCookedSoftDays,
  }

  /**
   * Builds every slot of the day, keeping locked meals when asked.
   *
   * The form's "nights you want to cook" belongs to the first cooking slot —
   * the one people mean when they say "how often do you cook". Any other
   * cooking slot keeps whatever it was configured with in Settings.
   */
  const generateWith = (using: Preferences, keepLocked = false, library?: Recipe[]) => {
    const locked = keepLocked ? (plans ?? []).flatMap((plan) => plan.meals) : []
    const request = buildRequest(using, locked)
    const types = PLAN_SCOPE_TYPES[using.scope]
    const inScope = types ? mealSlots.filter((slot) => types.includes(slot.type)) : mealSlots
    const planningSlots = inScope.map((slot, index) =>
      slot.fill === 'cook' && index === inScope.findIndex((s) => s.fill === 'cook')
        ? { ...slot, cookSessions: using.targetCookSessions, servings: using.servingsPerMeal }
        : slot,
    )
    const result = generateWeek({
      slots: planningSlots,
      dates: [...using.selectedDates].sort(),
      request,
      library: library ?? recipes ?? [],
      context: engineContext,
      defaultServings: using.servingsPerMeal,
    })
    setPlans(result.plans)
    setWarnings(result.warnings)
    setPassedOver({})
    // What the week had to fit inside is a standing preference, not a one-off.
    void update({
      planningDefaults: {
        ...settings.planningDefaults,
        // How many days you plan is a standing choice too — tapping "Whole
        // week" once should not have to be done again next week.
        mealsNeeded: using.selectedDates.length || settings.planningDefaults.mealsNeeded,
        targetCookSessions: using.targetCookSessions,
        planScope: using.scope,
        weekBudget: using.budget,
        maxMinutesPerMeal: using.maxMinutesPerMeal,
        proteinPerDay: using.proteinPerDay,
      },
    })
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

  /** Everything the wizard does to one meal is addressed by slot and day. */
  const patchPlan = (slotId: string, update: (meals: GeneratedSlot[]) => GeneratedSlot[]) =>
    setPlans(
      (current) =>
        current?.map((plan) =>
          plan.slot.id === slotId ? { ...plan, meals: update(plan.meals) } : plan,
        ) ?? null,
    )

  /**
   * A week of recipes nobody owns yet.
   *
   * The ordinary planner picks from the library, which is the right default
   * and no use on the evening you are bored of everything in it. This asks
   * the recipe databases instead — in the words of the preferences already on
   * screen, and only for the slots the scope covers — then plans with what
   * comes back. Nothing is saved until the plan is accepted, exactly as with
   * any other week.
   */
  const surpriseFromWeb = async () => {
    const types = PLAN_SCOPE_TYPES[prefs.scope]
    const inScope = types ? mealSlots.filter((slot) => types.includes(slot.type)) : mealSlots
    const dates = [...prefs.selectedDates].sort()
    const scoped = inScope.map((slot, index) =>
      slot.fill === 'cook' && index === inScope.findIndex((entry) => entry.fill === 'cook')
        ? { ...slot, cookSessions: prefs.targetCookSessions, servings: prefs.servingsPerMeal }
        : slot,
    )

    const needs = weekNeeds(scoped, dates)
    if (!needs.recipes) {
      toast('Nothing in this week needs a recipe chosen for it.')
      return
    }

    const found = await webWeek.gather(
      weekQueries({
        preferredMethods: prefs.preferredMethods,
        requiredMethods: prefs.requiredMethods,
        preferredEffort: prefs.preferredEffort,
        budgetPreference: prefs.budgetPreference,
        useUpIngredients: prefs.useUp.split(',').map((entry) => entry.trim()).filter(Boolean),
        mealTypes: needs.cookSlots.map((slot) => slot.type),
      }),
      // A little more than the week needs, so the planner has a choice and a
      // recipe that will not load is not a hole in the week.
      needs.recipes + 2,
    )

    if (!found.length) return
    setFromWeb(found)
    generateWith(prefs, false, found)
    setQuickPending(false)
  }

  /**
   * The two things people ask for when a week does not fit, expressed in the
   * levers the planner already has: cheaper means preferring budget recipes
   * and the pantry, quicker means a hard ceiling on hands-on minutes below
   * whatever the longest night just came out at.
   */
  const nudge = (towards: 'cheaper' | 'quicker') => {
    const next: Preferences =
      towards === 'cheaper'
        ? { ...prefs, budgetPreference: '$', usePantryFirst: true }
        : {
            ...prefs,
            preferredEffort: 'low',
            maxActiveTimeMinutes: Math.max(
              15,
              (prefs.maxMinutesPerMeal ?? fit?.longestMeal.value ?? 45) - 5,
            ),
          }
    setPrefs(next)
    generateWith(next, true, fromWeb.length ? fromWeb : undefined)
    toast(towards === 'cheaper' ? 'Leaning cheaper.' : 'Leaning quicker.')
  }

  const toggleLock = (slotId: string, date: string) =>
    patchPlan(slotId, (meals) =>
      meals.map((meal) => (meal.date === date ? { ...meal, locked: !meal.locked } : meal)),
    )

  const swap = (slotId: string, date: string, recipe: Recipe) => {
    const plan = plans?.find((entry) => entry.slot.id === slotId)
    const replaced = plan?.meals.find((meal) => meal.date === date)
    if (replaced?.recipeId && replaced.recipeId !== recipe.id) {
      // Turning a suggestion down is a signal worth remembering.
      void recordRejection(replaced.recipeId)
    }
    const perMeal = plan?.slot.servings ?? prefs.servingsPerMeal
    patchPlan(slotId, (meals) =>
      replaceCookSlot(meals, date, recipe, perMeal, ['You picked this one']),
    )
    setSwapping(null)
  }

  /**
   * "Not that one" — the next-best recipe for that meal, ranked against the
   * rest of the week as it stands, with everything already turned down for
   * that day kept out of the running.
   */
  const tryAnother = (slotId: string, date: string) => {
    const plan = plans?.find((entry) => entry.slot.id === slotId)
    if (!plan) return
    const current = plan.meals.find((meal) => meal.date === date)
    const key = `${slotId}:${date}`
    const alreadyPassed = passedOver[key] ?? []
    const suggestion = suggestAnother({
      slots: plan.meals,
      date,
      library: recipes ?? [],
      context: {
        ...contextFromRequest(buildRequest(prefs), engineContext),
        mealType: plan.slot.type,
      },
      perMeal: plan.slot.servings ?? prefs.servingsPerMeal,
      dayLoad: prefs.dayLoads[date],
      passedOver: new Set(alreadyPassed),
    })
    if (!suggestion) {
      toast(`Nothing else in your library fits ${plan.slot.label} on ${dayName(date)}.`)
      return
    }
    if (current?.recipeId) {
      void recordRejection(current.recipeId)
      setPassedOver((rest) => ({ ...rest, [key]: [...alreadyPassed, current.recipeId as string] }))
    }
    patchPlan(slotId, () => suggestion.slots)
  }

  const accept = async () => {
    if (!plans) return
    setAccepting(true)
    try {
      const plan = await getOrCreatePlan(weekStart)
      const existing = await listPlannedMeals(plan.id)

      /*
       * A surprise week is planned from recipes nobody owns yet, so accepting
       * it is the moment they become the user's — saved once each, and only
       * the ones the week actually used. Until here, nothing was written.
       */
      const saved = new Map<string, string>()
      for (const meal of plans.flatMap((entry) => entry.meals)) {
        if (!meal.recipeId || !isProvisional(meal.recipeId) || saved.has(meal.recipeId)) continue
        const recipe = fromWeb.find((entry) => entry.id === meal.recipeId)
        if (!recipe) continue
        const { id: _provisionalId, ...draft } = recipe
        const stored = await saveRecipe(draft)
        saved.set(meal.recipeId, stored.id)
      }
      if (saved.size) {
        toast(
          `Saved ${saved.size} new recipe${saved.size === 1 ? '' : 's'} to your library.`,
          { tone: 'success' },
        )
      }

      const meals = plans.flatMap((entry) =>
        entry.meals
          .filter((meal) => !meal.unfilled)
          .map((meal) => ({
            planId: plan.id,
            date: meal.date,
            mealType: entry.slot.type,
            slotId: entry.slot.id,
            kind: meal.kind,
            recipeId: meal.recipeId ? (saved.get(meal.recipeId) ?? meal.recipeId) : undefined,
            customName: meal.customName,
            servings: meal.servings,
            isLeftover: meal.kind === 'leftover',
            reasons: meal.reasons,
          })),
      )

      // Only the days and slots the wizard actually planned are replaced; the
      // rest of the week is left exactly as it was.
      await replacePlanMeals(plan.id, meals, {
        slotIds: plans.map((entry) => entry.slot.id),
        dates: [...new Set(plans.flatMap((entry) => entry.meals.map((meal) => meal.date)))],
      })

      await recordPlanned(
        plans
          .flatMap((entry) => entry.meals)
          .filter((meal) => meal.kind === 'recipe' && meal.recipeId)
          .map((meal) => saved.get(meal.recipeId as string) ?? (meal.recipeId as string)),
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

  const allMeals = plans?.flatMap((plan) => plan.meals) ?? []
  const cookCount = allMeals.filter((meal) => meal.kind === 'recipe' && !meal.unfilled).length
  const leftoverCount = allMeals.filter((meal) => meal.kind === 'leftover').length
  const routineCount = allMeals.filter((meal) => meal.kind === 'custom' && !meal.unfilled).length


  /** The preview reads day by day, with each of the day's slots under it. */
  const previewDays = [...new Set(allMeals.map((meal) => meal.date))].sort()

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

      {quickPending && !plans ? (
        <div className={styles.building} role="status">
          <Sparkles size={28} aria-hidden="true" />
          <p>Building your week from your recipes…</p>
        </div>
      ) : !plans ? (
        <>
          <section>
            <h2 className="section-title">
              What should MealHelp plan?
              <span className="text-sm faint">The rest of the day is left as it is</span>
            </h2>
            <div className="row-tight">
              {(Object.keys(PLAN_SCOPE_LABELS) as PlanScope[]).map((scope) => {
                const types = PLAN_SCOPE_TYPES[scope]
                const covered = types
                  ? mealSlots.filter((slot) => types.includes(slot.type))
                  : mealSlots
                return (
                  <button
                    key={scope}
                    type="button"
                    className="chip chip-button"
                    aria-pressed={prefs.scope === scope}
                    // Offering "dinners + lunches" to a kitchen that only has
                    // dinners set up would be a choice with no effect.
                    disabled={covered.length === 0}
                    onClick={() => {
                      set('scope', scope)
                      void update({
                        planningDefaults: { ...settings.planningDefaults, planScope: scope },
                      })
                    }}
                  >
                    {PLAN_SCOPE_LABELS[scope]}
                    <span className="text-sm faint">{covered.length}</span>
                  </button>
                )
              })}
            </div>
          </section>

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
                  {prefs.mealsNeeded} days of{' '}
                  {PLAN_SCOPE_LABELS[prefs.scope].toLowerCase()}, cook{' '}
                  {prefs.targetCookSessions}× — your usual
                </small>
              </button>
              <button
                type="button"
                className={`${styles.preset} ${styles.presetSurprise}`}
                onClick={() => void surpriseFromWeb()}
                disabled={webWeek.busy}
              >
                <strong>
                  <Dices size={15} aria-hidden="true" /> Surprise me
                </strong>
                <small>
                  {webWeek.busy
                    ? `Finding recipes… ${webWeek.progress?.found ?? 0} of ${webWeek.progress?.wanted ?? 0}`
                    : `A week of new recipes from the web — ${PLAN_SCOPE_LABELS[
                        prefs.scope
                      ].toLowerCase()}`}
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
            <h2 className="section-title">
              Which days
              <span className={styles.dayPresets}>
                {DAY_PRESETS.map((preset) => {
                  const chosen = preset.pick(dates)
                  const active =
                    chosen.length === prefs.selectedDates.length &&
                    chosen.every((date) => prefs.selectedDates.includes(date))
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="chip chip-button"
                      aria-pressed={active}
                      onClick={() =>
                        setPrefs((current) => ({
                          ...current,
                          selectedDates: chosen,
                          mealsNeeded: chosen.length,
                          // Cooking more nights than there are days is not a
                          // plan, it is an error message waiting to happen.
                          targetCookSessions: Math.min(current.targetCookSessions, chosen.length),
                        }))
                      }
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </span>
            </h2>
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
            <h2 className="section-title">
              What does it have to fit?
              <span className="text-sm faint">Leave any of them blank</span>
            </h2>
            <div className={styles.fitInputs}>
              <label className={styles.fitField}>
                <span className="field-label">Budget for the week</span>
                <span className={styles.fitInput}>
                  <span className={styles.prefix}>{settings.currency ?? '$'}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={5}
                    inputMode="numeric"
                    placeholder="no limit"
                    value={prefs.budget ?? ''}
                    onChange={(event) =>
                      set('budget', event.target.value === '' ? undefined : Number(event.target.value))
                    }
                  />
                </span>
                <span className="field-hint">Estimated from typical shop prices.</span>
              </label>

              <label className={styles.fitField}>
                <span className="field-label">Longest night</span>
                <span className={styles.fitInput}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={5}
                    inputMode="numeric"
                    placeholder="no limit"
                    value={prefs.maxMinutesPerMeal ?? ''}
                    onChange={(event) =>
                      set(
                        'maxMinutesPerMeal',
                        event.target.value === '' ? undefined : Number(event.target.value),
                      )
                    }
                  />
                  <span className={styles.suffix}>min</span>
                </span>
                <span className="field-hint">Hands-on time, not time in the oven.</span>
              </label>

              <label className={styles.fitField}>
                <span className="field-label">Protein a day</span>
                <span className={styles.fitInput}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={5}
                    inputMode="numeric"
                    placeholder="no goal"
                    value={prefs.proteinPerDay ?? ''}
                    onChange={(event) =>
                      set(
                        'proteinPerDay',
                        event.target.value === '' ? undefined : Number(event.target.value),
                      )
                    }
                  />
                  <span className={styles.suffix}>g</span>
                </span>
                <span className="field-hint">Counted per person, per day.</span>
              </label>
            </div>
            <p className="field-hint">
              These are checked once the week is built, with a way to nudge it
              cheaper or quicker if it misses.
            </p>
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
                ? ` · ${leftoverCount} meal${leftoverCount === 1 ? '' : 's'} of leftovers`
                : ''}
              {routineCount ? ` · ${routineCount} the usual` : ''}
            </p>
            <p className="text-sm muted">
              Nothing is saved until you accept the plan.
            </p>
          </div>

          {fit ? (
            <WeekFitPanel
              fit={fit}
              targets={targets}
              currency={settings.currency}
              onCheaper={() => nudge('cheaper')}
              onQuicker={() => nudge('quicker')}
            />
          ) : null}

          {fromWeb.length ? (
            <p className={styles.fromWebNote}>
              <Dices size={14} aria-hidden="true" />
              New recipes from the recipe databases. Nothing is saved until you accept
              — and then they join your library.
            </p>
          ) : null}

          {webWeek.error ? <p className={styles.warning}>{webWeek.error}</p> : null}

          {warnings.map((warning) => (
            <p key={warning} className={styles.warning}>
              {warning}
            </p>
          ))}

          <ol className={styles.previewDays}>
            {previewDays.map((date) => (
              <li key={date} className={styles.previewDay}>
                <div className={styles.dayHead}>
                  <strong>{dayName(date)}</strong>
                  <small>{monthDay(date)}</small>
                </div>

                <ul className={styles.dayMeals}>
                  {plans!.map((plan) => {
                    const meal = plan.meals.find((entry) => entry.date === date)
                    if (!meal) return null
                    const key = `${plan.slot.id}:${date}`
                    const open = peeking === key

                    return (
                      <li
                        key={key}
                        className={`${styles.meal} ${
                          meal.kind === 'leftover' ? styles.leftoverMeal : ''
                        }`}
                      >
                        <div className={styles.mealMain}>
                          {meal.recipe ? (
                            <MealCard
                              recipe={meal.recipe}
                              size="compact"
                              onSelect={() => setPeeking(open ? undefined : key)}
                              eyebrow={
                                plans!.length > 1 || plan.slot.fill !== 'cook'
                                  ? plan.slot.label
                                  : undefined
                              }
                            >
                              <p className={styles.mealMeta}>
                                {meal.kind === 'leftover'
                                  ? `Leftovers${meal.sourceDate ? ` from ${dayNameShort(meal.sourceDate)}` : ''}`
                                  : meal.servings
                                    ? `Cook ${meal.servings} servings`
                                    : null}
                              </p>
                            </MealCard>
                          ) : (
                            <div className={styles.plainMeal}>
                              <span className={styles.slotName}>{plan.slot.label}</span>
                              <strong>
                                {meal.unfilled
                                  ? plan.slot.fill === 'routine'
                                    ? 'Nothing set yet'
                                    : 'Nothing fit this day'
                                  : (meal.customName ?? 'Meal')}
                              </strong>
                            </div>
                          )}

                          <div className={styles.mealActions}>
                            {meal.recipe ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                aria-expanded={open}
                                onClick={() => setPeeking(open ? undefined : key)}
                              >
                                {open ? (
                                  <ChevronUp size={15} aria-hidden="true" />
                                ) : (
                                  <ChevronDown size={15} aria-hidden="true" />
                                )}
                                {open ? 'Hide' : 'Look at it'}
                              </button>
                            ) : null}

                            {plan.slot.fill === 'cook' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  onClick={() => toggleLock(plan.slot.id, date)}
                                  aria-pressed={Boolean(meal.locked)}
                                  aria-label={meal.locked ? 'Unlock this meal' : 'Lock this meal'}
                                >
                                  {meal.locked ? (
                                    <Lock size={16} aria-hidden="true" />
                                  ) : (
                                    <LockOpen size={16} aria-hidden="true" />
                                  )}
                                </button>
                                {meal.kind === 'recipe' ? (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => tryAnother(plan.slot.id, date)}
                                    disabled={Boolean(meal.locked)}
                                    aria-label="Try another suggestion"
                                    title="Try another"
                                  >
                                    <Shuffle size={16} aria-hidden="true" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  onClick={() => setSwapping(key)}
                                  aria-label="Replace with one you choose"
                                  title="Choose a recipe"
                                >
                                  <Replace size={16} aria-hidden="true" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {meal.reasons.length && !open ? (
                          <ul className={styles.reasons}>
                            {meal.reasons.slice(0, 3).map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}

                        {open && meal.recipe ? (
                          <RecipePeek recipe={meal.recipe} servings={meal.servings} />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>

          <div className={styles.previewActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => generate(true)}
            >
              <RefreshCw size={17} aria-hidden="true" />
              Regenerate
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPlans(null)}>
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
              mealType={
                plans?.find((plan) => plan.slot.id === swapping?.split(':')[0])?.slot.type
              }
              excludeIds={allMeals
                .map((meal) => meal.recipeId)
                .filter((id): id is string => Boolean(id))}
              onSelect={(recipe) => {
                if (!swapping) return
                const [slotId, date] = swapping.split(':')
                swap(slotId, date, recipe)
              }}
            />
          </Modal>
        </>
      )}
    </div>
  )
}
