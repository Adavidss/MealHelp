import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, List, Minus, Plus, Timer, X } from 'lucide-react'
import { db } from '@/db/database'
import { useSettings } from '@/app/SettingsContext'
import { formatMinutes } from '@/utils/date'
import { displayIngredientSections } from '@/features/recipes/ingredientDisplay'
import { FinishCookingDialog } from './FinishCookingDialog'
import { formatCountdown, useTimers } from './useTimers'
import { useWakeLock } from './useWakeLock'
import { clearCookingProgress, readCookingProgress, saveCookingProgress } from './cookingProgress'
import { ingredientsForStep } from './stepIngredients'
import { timerFromText } from './stepTimer'
import styles from './CookingModePage.module.css'

/**
 * Cooking mode is a different application wearing the same colours: no
 * navigation to hit by accident, text you can read from across the counter, and
 * targets big enough for a knuckle.
 */
export function CookingModePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { settings } = useSettings()

  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])

  const saved = useMemo(() => (id ? readCookingProgress(id) : undefined), [id])
  const [step, setStep] = useState(saved?.step ?? 0)
  const [checked, setChecked] = useState<Set<string>>(new Set(saved?.checked ?? []))
  const [servings, setServings] = useState<number>(saved?.servings ?? 0)
  const [finishing, setFinishing] = useState(false)
  const [showingSteps, setShowingSteps] = useState(false)
  const [showingIngredients, setShowingIngredients] = useState(false)

  const { timers, start, dismiss } = useTimers()
  useWakeLock(settings.keepScreenAwakeWhileCooking)

  const plannedServings = Number(searchParams.get('servings')) || undefined
  const plannedMealId = searchParams.get('plannedMeal') ?? undefined

  useEffect(() => {
    if (servings || !recipe) return
    setServings(plannedServings ?? recipe.servings ?? settings.defaultServings)
  }, [recipe, servings, plannedServings, settings.defaultServings])

  // Every change is written down: a phone that locks, or a browser that throws
  // the page away while you are in a timer app, must not cost you your place.
  useEffect(() => {
    if (!id || !recipe) return
    saveCookingProgress(id, { step, checked: [...checked], servings })
  }, [id, recipe, step, checked, servings])

  const scale = useMemo(() => {
    if (!recipe?.servings || !servings) return 1
    return servings / recipe.servings
  }, [recipe, servings])

  /* Swiping is how anybody holds a phone with one clean hand. */
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Sideways, and clearly so: scrolling a long ingredient list is not a swipe.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    setStep((current) => (dx < 0 ? current + 1 : Math.max(0, current - 1)))
  }

  const sections = useMemo(
    () => (recipe ? displayIngredientSections(recipe.ingredients, scale) : []),
    [recipe, scale],
  )

  // Arrow keys work for a tablet with a keyboard propped up on the counter.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowRight') setStep((s) => s + 1)
      if (event.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (recipe === undefined) {
    return (
      <div className={styles.screen}>
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className={styles.screen}>
        <p>That recipe is no longer in your library.</p>
        <Link to="/recipes" className="btn btn-secondary">
          Back to recipes
        </Link>
      </div>
    )
  }

  const steps = recipe.instructions
  const totalSteps = steps.length
  // Step 0 is the ingredient check; the directions follow it.
  const onIngredients = step === 0
  const currentStep = steps[step - 1]
  const atEnd = step > totalSteps

  const allItems = sections.flatMap((section) => section.items)
  // What this step is talking about, at the scale being cooked.
  const stepItems = currentStep ? ingredientsForStep(currentStep.text, allItems) : []
  // A structured timing if the recipe has one, otherwise whatever the sentence says.
  const timerMinutes = currentStep?.timerMinutes ?? timerFromText(currentStep?.text)

  const toggleChecked = (ingredientId: string) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Cooking</p>
          <h1 className={styles.title}>{recipe.title}</h1>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => navigate(`/recipes/${recipe.id}`)}
          aria-label="Leave cooking mode"
        >
          <X size={24} aria-hidden="true" />
        </button>
      </header>

      {timers.length ? (
        <ul className={styles.timers}>
          {timers.map((timer) => (
            <li
              key={timer.id}
              className={timer.done ? `${styles.timer} ${styles.timerDone}` : styles.timer}
            >
              <span className={styles.timerLabel}>{timer.label}</span>
              <span className={styles.timerValue}>
                {timer.done ? 'Done' : formatCountdown(timer.remainingMs)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => dismiss(timer.id)}
                aria-label={`Dismiss timer for ${timer.label}`}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.progress} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${(Math.min(step, totalSteps) / Math.max(1, totalSteps)) * 100}%` }}
        />
      </div>

      <main className={styles.body} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {onIngredients ? (
          <>
            <div className={styles.servingsRow}>
              <span className={styles.servingsLabel}>Making</span>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setServings((s) => Math.max(1, (s ?? 1) - 1))}
                aria-label="One fewer serving"
              >
                <Minus size={20} aria-hidden="true" />
              </button>
              <span className={styles.servingsValue}>{servings}</span>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setServings((s) => (s ?? 1) + 1)}
                aria-label="One more serving"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
              <span className={styles.servingsLabel}>servings</span>
            </div>

            <h2 className={styles.stepHeading}>Ingredients</h2>
            {sections.map((section, index) => (
              <div key={section.title ?? index}>
                {section.title ? (
                  <h3 className={styles.subHeading}>{section.title}</h3>
                ) : null}
                <ul className={styles.ingredients}>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <label className={styles.ingredient}>
                        <input
                          type="checkbox"
                          checked={checked.has(item.id)}
                          onChange={() => toggleChecked(item.id)}
                          className={styles.checkbox}
                        />
                        <span
                          className={checked.has(item.id) ? styles.struck : undefined}
                        >
                          {item.quantityText ? (
                            <strong>{item.quantityText}</strong>
                          ) : null}{' '}
                          {item.name}
                          {item.preparation ? (
                            <span className={styles.preparation}>, {item.preparation}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        ) : atEnd ? (
          <div className={styles.finish}>
            <h2 className={styles.stepHeading}>That's everything.</h2>
            <p className={styles.finishText}>
              Log what you made and MealHelp will keep track of the leftovers.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => setFinishing(true)}
            >
              I'm done cooking
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={styles.stepCount}
              onClick={() => setShowingSteps((open) => !open)}
              aria-expanded={showingSteps}
            >
              <List size={15} aria-hidden="true" />
              Step {step} of {totalSteps}
            </button>

            {/* Every step at once, to jump back to the one you half-read. It
                stands alone while it is open: repeating the current step under
                it just pushed everything else off the screen. */}
            {showingSteps ? (
              <ol className={styles.stepList}>
                {steps.map((entry, index) => (
                  <li key={entry.id ?? index}>
                    <button
                      type="button"
                      className={index + 1 === step ? styles.stepLinkCurrent : styles.stepLink}
                      onClick={() => {
                        setStep(index + 1)
                        setShowingSteps(false)
                      }}
                    >
                      <span className={styles.stepLinkNumber}>{index + 1}</span>
                      <span>{entry.text}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {!showingSteps ? <p className={styles.stepText}>{currentStep?.text}</p> : null}

            {timerMinutes && !showingSteps ? (
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => start(timerMinutes, `Step ${step} · ${recipe.title}`, recipe.id)}
              >
                <Timer size={19} aria-hidden="true" />
                Start {formatMinutes(timerMinutes)} timer
              </button>
            ) : null}

            {/*
              The amounts, beside the sentence that needs them. "Brown the beef
              with the onion" is not much use to somebody who cannot remember
              whether it was one onion or two, and going back to look meant
              losing the step.
            */}
            {stepItems.length && !showingSteps ? (
              <section className={styles.stepIngredients}>
                <h2 className={styles.stepIngredientsHeading}>For this step</h2>
                <ul className={styles.ingredients}>
                  {stepItems.map((item) => (
                    <li key={item.id}>
                      <label className={styles.ingredient}>
                        <input
                          type="checkbox"
                          checked={checked.has(item.id)}
                          onChange={() => toggleChecked(item.id)}
                          className={styles.checkbox}
                        />
                        <span className={checked.has(item.id) ? styles.struck : undefined}>
                          {item.quantityText ? <strong>{item.quantityText}</strong> : null}{' '}
                          {item.name}
                          {item.preparation ? (
                            <span className={styles.preparation}>, {item.preparation}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* And the rest of them, one tap away, without leaving the step. */}
            <button
              type="button"
              hidden={showingSteps}
              className={styles.everything}
              onClick={() => setShowingIngredients((open) => !open)}
              aria-expanded={showingIngredients}
            >
              {showingIngredients ? 'Hide' : 'All'} ingredients
              {checked.size ? ` · ${checked.size} of ${allItems.length} ticked` : ''}
            </button>
            {showingIngredients && !showingSteps ? (
              <ul className={styles.ingredients}>
                {allItems.map((item) => (
                  <li key={item.id}>
                    <label className={styles.ingredient}>
                      <input
                        type="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggleChecked(item.id)}
                        className={styles.checkbox}
                      />
                      <span className={checked.has(item.id) ? styles.struck : undefined}>
                        {item.quantityText ? <strong>{item.quantityText}</strong> : null}{' '}
                        {item.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </main>

      <nav className={styles.footer} aria-label="Recipe steps">
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft size={20} aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => setStep((s) => Math.min(totalSteps + 1, s + 1))}
          disabled={atEnd}
        >
          {onIngredients ? 'Start' : 'Next'}
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </nav>

      <FinishCookingDialog
        open={finishing}
        recipe={recipe}
        defaultServings={servings ?? recipe.servings ?? 4}
        plannedMealId={plannedMealId}
        onClose={() => setFinishing(false)}
        onDone={() => {
          // Cooked and logged: there is no half-finished meal to come back to.
          clearCookingProgress(recipe.id)
          navigate(`/recipes/${recipe.id}`)
        }}
      />
    </div>
  )
}
