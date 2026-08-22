import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { MealSlotConfig, MealType, NutrientKey, SlotFill } from '@/models'
import { MEAL_TYPES, MEAL_TYPE_LABELS, NUTRIENTS, SLOT_FILL_LABELS } from '@/models'
import { newId } from '@/utils/id'
import styles from './MealSlotEditor.module.css'

interface MealSlotEditorProps {
  slots: MealSlotConfig[]
  onChange: (slots: MealSlotConfig[]) => void
  defaultServings: number
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The four a label leads with. A routine has no recipe to read numbers off, so
 * without them a day of cereal, leftovers and dinner reports two thirds of
 * what was eaten — but nobody is typing nine nutrients in for a bowl of
 * cereal, so this asks for the four that matter and leaves the rest empty.
 */
const ROUTINE_NUTRIENTS = NUTRIENTS.filter((nutrient) => nutrient.headline)

/** Sensible starting points, so adding a meal is one tap and not a form. */
const PRESETS: Array<{ label: string; make: () => MealSlotConfig }> = [
  {
    label: 'Breakfast',
    make: () => ({
      id: newId('slot'),
      label: 'Breakfast',
      type: 'breakfast',
      fill: 'routine',
      routine: { name: '', groceryLines: [] },
    }),
  },
  {
    label: 'Lunch',
    make: () => ({ id: newId('slot'), label: 'Lunch', type: 'lunch', fill: 'leftovers' }),
  },
  {
    label: 'Dinner',
    make: () => ({ id: newId('slot'), label: 'Dinner', type: 'dinner', fill: 'cook', cookSessions: 3 }),
  },
  {
    label: 'Snack',
    make: () => ({ id: newId('slot'), label: 'Snack', type: 'snack', fill: 'open' }),
  },
]

/**
 * The day, as the user actually eats it.
 *
 * MealHelp used to ask which meal *types* to show, which is a different and
 * less useful question: it cannot express two breakfasts, a post-gym snack, or
 * that Saturday brunch replaces both breakfast and lunch. A slot is a thing you
 * eat at a time of day, with a name you chose and a rule for how it gets
 * filled — and only the "cook something" ones cost the planner any thought.
 */
export function MealSlotEditor({ slots, onChange, defaultServings }: MealSlotEditorProps) {
  const [openId, setOpenId] = useState<string>()

  const patch = (id: string, change: Partial<MealSlotConfig>) =>
    onChange(slots.map((slot) => (slot.id === id ? { ...slot, ...change } : slot)))

  const move = (index: number, by: number) => {
    const next = [...slots]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const remove = (id: string) => {
    // The planner needs somewhere to put a meal, so the last slot stays.
    if (slots.length <= 1) return
    onChange(slots.filter((slot) => slot.id !== id))
  }

  const add = (preset: (typeof PRESETS)[number]) => {
    const slot = preset.make()
    onChange([...slots, slot])
    setOpenId(slot.id)
  }

  const toggleDay = (slot: MealSlotConfig, day: number) => {
    const current = slot.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]
    const next = current.includes(day)
      ? current.filter((entry) => entry !== day)
      : [...current, day].sort()
    // Every day is the normal case, and is stored as "no restriction".
    patch(slot.id, { daysOfWeek: next.length === 7 ? undefined : next })
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {slots.map((slot, index) => {
          const open = openId === slot.id
          const days = slot.daysOfWeek
          return (
            <li key={slot.id} className={styles.slot}>
              <div className={styles.head}>
                <button
                  type="button"
                  className={styles.summary}
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? undefined : slot.id)}
                >
                  <span className={styles.name}>{slot.label || 'Untitled'}</span>
                  <span className={styles.rule}>
                    {SLOT_FILL_LABELS[slot.fill]}
                    {slot.fill === 'routine' && slot.routine?.name
                      ? ` · ${slot.routine.name}`
                      : ''}
                    {slot.fill === 'cook' && slot.cookSessions
                      ? ` · ${slot.cookSessions}× a week`
                      : ''}
                    {days?.length ? ` · ${days.map((d) => DAY_INITIALS[d]).join('')}` : ''}
                  </span>
                </button>
                <div className={styles.headActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${slot.label} earlier in the day`}
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, 1)}
                    disabled={index === slots.length - 1}
                    aria-label={`Move ${slot.label} later in the day`}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {open ? (
                <div className={styles.body}>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span className="field-label">What you call it</span>
                      <input
                        className="input"
                        value={slot.label}
                        onChange={(event) => patch(slot.id, { label: event.target.value })}
                        placeholder="Breakfast"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className="field-label">Kind of meal</span>
                      <select
                        className="select"
                        value={slot.type}
                        onChange={(event) =>
                          patch(slot.id, { type: event.target.value as MealType })
                        }
                      >
                        {MEAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {MEAL_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <span className="field-hint">Which recipes get suggested for it.</span>
                    </label>
                  </div>

                  <div className="field">
                    <span className="field-label">How it gets filled</span>
                    <div className="row-tight">
                      {(Object.keys(SLOT_FILL_LABELS) as SlotFill[]).map((fill) => (
                        <button
                          key={fill}
                          type="button"
                          className="chip chip-button"
                          aria-pressed={slot.fill === fill}
                          onClick={() => patch(slot.id, { fill })}
                        >
                          {SLOT_FILL_LABELS[fill]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {slot.fill === 'routine' ? (
                    <>
                      <label className="field">
                        <span className="field-label">What you always have</span>
                        <input
                          className="input"
                          value={slot.routine?.name ?? ''}
                          onChange={(event) =>
                            patch(slot.id, {
                              routine: {
                                ...slot.routine,
                                name: event.target.value,
                                groceryLines: slot.routine?.groceryLines ?? [],
                              },
                            })
                          }
                          placeholder="A bowl of Kellogg's Strawberry Special K"
                        />
                      </label>
                      <div className="field">
                        <span className="field-label">What one contains, roughly</span>
                        <div className={styles.nutrients}>
                          {ROUTINE_NUTRIENTS.map((nutrient) => (
                            <label key={nutrient.key} className={styles.nutrient}>
                              <span>{nutrient.label}</span>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={slot.routine?.nutrition?.[nutrient.key] ?? ''}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  patch(slot.id, {
                                    routine: {
                                      name: slot.routine?.name ?? '',
                                      groceryLines: slot.routine?.groceryLines ?? [],
                                      nutrition: {
                                        ...slot.routine?.nutrition,
                                        [nutrient.key as NutrientKey]:
                                          event.target.value === '' || !Number.isFinite(value)
                                            ? undefined
                                            : value,
                                      },
                                    },
                                  })
                                }}
                              />
                              <small>{nutrient.unit}</small>
                            </label>
                          ))}
                        </div>
                        <span className="field-hint">
                          Optional, and off the packet is fine. Without it the nutrition
                          page counts this meal but has nothing to add for it.
                        </span>
                      </div>

                      <label className="field">
                        <span className="field-label">What that needs from the shop</span>
                        <textarea
                          className="textarea"
                          rows={3}
                          value={(slot.routine?.groceryLines ?? []).join('\n')}
                          onChange={(event) =>
                            patch(slot.id, {
                              routine: {
                                ...slot.routine,
                                name: slot.routine?.name ?? '',
                                groceryLines: event.target.value
                                  .split('\n')
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              },
                            })
                          }
                          placeholder={'1 box Special K strawberry\n2 L milk'}
                        />
                        <span className="field-hint">
                          One per line, written the way you buy it. These go on the list once
                          for the week, not once per day.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {slot.fill === 'cook' ? (
                    <div className="field">
                      <span className="field-label">Cook for it how often</span>
                      <div className="row-tight">
                        {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className="chip chip-button"
                            aria-pressed={(slot.cookSessions ?? 7) === count}
                            onClick={() => patch(slot.id, { cookSessions: count })}
                          >
                            {count}×
                          </button>
                        ))}
                      </div>
                      <span className="field-hint">
                        The rest of the days eat what those sessions leave over.
                      </span>
                    </div>
                  ) : null}

                  {slot.fill === 'leftovers' ? (
                    <p className="field-hint">
                      Filled from whatever was cooked earlier in the week — and the cooking
                      is sized to cover it, so nothing is promised twice.
                    </p>
                  ) : null}

                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span className="field-label">People</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={12}
                        value={slot.servings ?? defaultServings}
                        onChange={(event) =>
                          patch(slot.id, { servings: Number(event.target.value) || undefined })
                        }
                      />
                    </label>
                    <div className={styles.field}>
                      <span className="field-label">Days it happens</span>
                      <div className={styles.days}>
                        {DAY_INITIALS.map((initial, day) => (
                          <button
                            key={day}
                            type="button"
                            className={styles.day}
                            aria-pressed={!days?.length || days.includes(day)}
                            aria-label={`Day ${day + 1}`}
                            onClick={() => toggleDay(slot, day)}
                          >
                            {initial}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => remove(slot.id)}
                    disabled={slots.length <= 1}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Remove this meal
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className={styles.add}>
        <span className="field-hint">Add a meal to the day</span>
        <div className="row-tight">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="chip chip-button"
              onClick={() => add(preset)}
            >
              <Plus size={13} aria-hidden="true" />
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
