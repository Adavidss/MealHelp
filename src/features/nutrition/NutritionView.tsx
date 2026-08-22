import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { addNutritionLogEntry, deleteNutritionLogEntry, listNutritionLog } from '@/db/nutritionLog'
import type { Nutrition, NutritionLogEntry, PlannedMeal, Recipe } from '@/models'
import { NUTRIENTS, type NutrientKey } from '@/models'
import {
  dayTotals,
  formatNutrient,
  percentOfTarget,
  resolveTargets,
  searchOpenFoodFacts,
  type FoodFactsHit,
} from '@/services/nutrition'
import { Modal } from '@/components/common/Modal'
import { SearchField } from '@/components/common/SearchField'
import { useToast } from '@/components/common/Toast'
import { addDays, dayNameShort, formatWeekRange, monthDay, relativeDayLabel, startOfWeek, todayISO, weekDates } from '@/utils/date'
import styles from './NutritionView.module.css'

/**
 * What a day adds up to, against what you are aiming for.
 *
 * Every planned meal counts as one serving eaten; anything else goes in the
 * log. Meals whose recipe has no numbers are listed as uncounted with a way
 * to fix it, rather than quietly making the day look lighter than it was.
 */
export function NutritionView() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const weekStart = startOfWeek(date, settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  const plans = useLiveQuery(() => db.mealPlans.where('weekStart').equals(weekStart).toArray(), [weekStart], [])
  const meals = useLiveQuery(
    async () => {
      const ids = (plans ?? []).map((plan) => plan.id)
      if (!ids.length) return [] as PlannedMeal[]
      return db.plannedMeals.where('planId').anyOf(ids).toArray()
    },
    [plans],
    [] as PlannedMeal[],
  )
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const log = useLiveQuery(() => listNutritionLog(dates), [dates], [] as NutritionLogEntry[])

  const recipesById = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes])
  const targets = useMemo(() => resolveTargets(settings.nutritionTargets), [settings.nutritionTargets])

  const week = useMemo(
    () => dates.map((day) => dayTotals(day, meals ?? [], recipesById, log ?? [])),
    [dates, meals, recipesById, log],
  )
  const day = week.find((entry) => entry.date === date) ?? week[0]

  const [logOpen, setLogOpen] = useState(false)

  const headline = NUTRIENTS.filter((n) => n.headline)
  const detail = NUTRIENTS.filter((n) => !n.headline)
  const maxCalories = Math.max(targets.calories, ...week.map((d) => d.total.calories ?? 0))

  const remove = async (entry: NutritionLogEntry) => {
    await deleteNutritionLogEntry(entry.id)
    toast(`Removed ${entry.name}.`)
  }

  return (
    <div className={styles.view}>
      <div className={styles.dayNav}>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className={styles.dayTitle}>
          <strong>{relativeDayLabel(date, today)}</strong>
          <small>{monthDay(date)} · {formatWeekRange(weekStart)}</small>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/* The week at a glance: one bar per day, calories against the target. */}
      <ol className={styles.weekStrip} aria-label="Calories this week">
        {week.map((entry) => {
          const calories = entry.total.calories ?? 0
          const height = maxCalories ? Math.max(4, Math.round((calories / maxCalories) * 100)) : 4
          const over = calories > targets.calories
          return (
            <li key={entry.date}>
              <button
                type="button"
                className={`${styles.dayBar} ${entry.date === date ? styles.dayBarActive : ''}`}
                onClick={() => setDate(entry.date)}
                aria-label={`${dayNameShort(entry.date)}: ${Math.round(calories)} calories`}
                aria-pressed={entry.date === date}
              >
                <span className={styles.barTrack}>
                  <span
                    className={`${styles.barFill} ${over ? styles.barOver : ''}`}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className={styles.barLabel}>{dayNameShort(entry.date).slice(0, 2)}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <section className={styles.totals}>
        {headline.map((nutrient) => {
          const value = day.total[nutrient.key]
          const percent = percentOfTarget(value, targets[nutrient.key])
          return (
            <div key={nutrient.key} className={styles.gauge}>
              <div className={styles.gaugeHead}>
                <span className={styles.gaugeLabel}>{nutrient.label}</span>
                <span className={styles.gaugeValue}>
                  {formatNutrient(nutrient.key, value ?? 0)}
                  <small> / {formatNutrient(nutrient.key, targets[nutrient.key])}</small>
                </span>
              </div>
              <div className={styles.track} role="progressbar" aria-valuenow={Math.min(percent, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${nutrient.label}: ${percent}% of target`}>
                <div
                  className={`${styles.fill} ${percent > 100 ? styles.fillOver : ''}`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <span className={styles.percent}>{percent}%</span>
            </div>
          )
        })}
      </section>

      <dl className={styles.detail}>
        {detail.map((nutrient) => (
          <div key={nutrient.key} className={styles.detailRow}>
            <dt>{nutrient.label}</dt>
            <dd>
              {formatNutrient(nutrient.key, day.total[nutrient.key] ?? 0)}
              <small> · {percentOfTarget(day.total[nutrient.key], targets[nutrient.key])}%</small>
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <div className={styles.sectionHead}>
          <h2 className="section-title">What counts today</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLogOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Log something
          </button>
        </div>

        {day.contributions.length === 0 ? (
          <p className="text-sm muted">
            Nothing planned or logged for this day. Plan a meal, or log what you ate.
          </p>
        ) : (
          <ul className={styles.items}>
            {day.contributions.map((item) => (
              <li key={item.id} className={styles.item}>
                <span className={styles.itemText}>
                  {item.recipeId ? (
                    <Link to={`/recipes/${item.recipeId}`}>{item.label}</Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  <small>
                    {item.kind === 'log' ? 'Logged' : 'Planned meal'}
                    {item.missing ? ' · no nutrition on this recipe' : ''}
                  </small>
                </span>
                {item.missing && item.recipeId ? (
                  <Link to={`/recipes/${item.recipeId}`} className="btn btn-ghost btn-sm">
                    Add numbers
                  </Link>
                ) : (
                  <span className={styles.itemValue}>
                    {formatNutrient('calories', item.nutrition.calories)} kcal
                  </span>
                )}
                {item.kind === 'log' ? (
                  <button
                    type="button"
                    className={`${styles.remove} tap-target`}
                    onClick={() => {
                      const entry = (log ?? []).find((e) => e.id === item.id)
                      if (entry) void remove(entry)
                    }}
                    aria-label={`Remove ${item.label}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {day.uncounted ? (
          <p className={styles.uncounted}>
            {day.uncounted} meal{day.uncounted === 1 ? '' : 's'} not counted — open the recipe and
            estimate or enter its nutrition.
          </p>
        ) : null}
      </section>

      <p className={styles.targetsNote}>
        Targets: {Math.round(targets.calories)} kcal · {targets.protein} g protein · {targets.carbs} g carbs ·{' '}
        {targets.fat} g fat. <Link to="/settings">Change them</Link>.
      </p>

      <LogDialog open={logOpen} date={date} onClose={() => setLogOpen(false)} />
    </div>
  )
}

const LOG_FIELDS: Array<{ key: NutrientKey; label: string }> = [
  { key: 'calories', label: 'kcal' },
  { key: 'protein', label: 'Protein g' },
  { key: 'carbs', label: 'Carbs g' },
  { key: 'fat', label: 'Fat g' },
]

/**
 * Logging something that was not on the plan. Type the numbers, or look the
 * thing up on Open Food Facts and take them from there.
 */
function LogDialog({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [values, setValues] = useState<Partial<Record<NutrientKey, string>>>({})
  const [lookup, setLookup] = useState('')
  const [hits, setHits] = useState<FoodFactsHit[]>()
  const [searching, setSearching] = useState(false)
  const [source, setSource] = useState<string>()
  const inFlight = useRef<AbortController>(null)

  useEffect(() => {
    if (!open) {
      setName('')
      setQuantity('1')
      setValues({})
      setLookup('')
      setHits(undefined)
      setSource(undefined)
    }
  }, [open])

  const search = async () => {
    const query = (lookup || name).trim()
    if (!query) return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setSearching(true)
    try {
      setHits(await searchOpenFoodFacts(query, controller.signal))
    } catch {
      if (!controller.signal.aborted) {
        toast("Open Food Facts didn't answer. Type the numbers in instead.", { tone: 'error' })
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  const pick = (hit: FoodFactsHit) => {
    setName(hit.brand ? `${hit.name} (${hit.brand})` : hit.name)
    setValues({
      calories: hit.nutrition.calories != null ? String(hit.nutrition.calories) : '',
      protein: hit.nutrition.protein != null ? String(hit.nutrition.protein) : '',
      carbs: hit.nutrition.carbs != null ? String(hit.nutrition.carbs) : '',
      fat: hit.nutrition.fat != null ? String(hit.nutrition.fat) : '',
      fiber: hit.nutrition.fiber != null ? String(hit.nutrition.fiber) : '',
      sugar: hit.nutrition.sugar != null ? String(hit.nutrition.sugar) : '',
      sodium: hit.nutrition.sodium != null ? String(hit.nutrition.sodium) : '',
      saturatedFat: hit.nutrition.saturatedFat != null ? String(hit.nutrition.saturatedFat) : '',
    })
    setSource(`Open Food Facts · per ${hit.basis === 'serving' ? (hit.servingSize ?? 'serving') : '100 g'}`)
    setHits(undefined)
  }

  const save = async () => {
    const nutrition: Nutrition = {}
    for (const nutrient of NUTRIENTS) {
      const raw = values[nutrient.key]
      if (raw == null || raw.trim() === '') continue
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed >= 0) nutrition[nutrient.key] = parsed
    }
    if (!name.trim() || Object.keys(nutrition).length === 0) {
      toast('Give it a name and at least the calories.', { tone: 'error' })
      return
    }
    await addNutritionLogEntry({
      date,
      name,
      quantity: Number(quantity) || 1,
      nutrition,
      source,
    })
    toast(`Logged ${name.trim()}.`, { tone: 'success' })
    onClose()
  }

  return (
    <Modal
      open={open}
      title={`Log for ${relativeDayLabel(date, todayISO())}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            Log it
          </button>
        </>
      }
    >
      <div className={styles.lookupRow}>
        <SearchField
          value={lookup}
          onChange={setLookup}
          onSubmit={() => void search()}
          placeholder="Look up a product — oat milk, granola bar…"
          label="Look up on Open Food Facts"
          trailing={
            <button type="button" className={styles.lookupButton} onClick={() => void search()} disabled={searching} aria-label="Search Open Food Facts">
              {searching ? <Loader2 size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
            </button>
          }
        />
      </div>
      {hits ? (
        hits.length ? (
          <ul className={styles.hits}>
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" className={styles.hit} onClick={() => pick(hit)}>
                  <strong>{hit.name}</strong>
                  <small>
                    {hit.brand ? `${hit.brand} · ` : ''}
                    {formatNutrient('calories', hit.nutrition.calories)} kcal per{' '}
                    {hit.basis === 'serving' ? (hit.servingSize ?? 'serving') : '100 g'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">Nothing found — type the numbers in below.</p>
        )
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="log-name">
          What
        </label>
        <input
          id="log-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Afternoon latte"
        />
      </div>
      <div className={styles.numbers}>
        {LOG_FIELDS.map((field) => (
          <label key={field.key} className={styles.number}>
            <span className="field-label">{field.label}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              value={values[field.key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
        <label className={styles.number}>
          <span className="field-label">Portions</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0.25"
            step="0.25"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
      </div>
      {source ? <p className="field-hint">{source}</p> : null}
    </Modal>
  )
}
