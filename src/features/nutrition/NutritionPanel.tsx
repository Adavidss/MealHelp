import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, PencilLine, Sparkles } from 'lucide-react'
import { updateRecipe } from '@/db/recipes'
import type { Recipe } from '@/models'
import { NUTRIENTS } from '@/models'
import { estimateNutrition, formatNutrient, hasNutrition } from '@/services/nutrition'
import { useToast } from '@/components/common/Toast'
import styles from './NutritionPanel.module.css'

const SOURCE_LABEL = {
  site: 'From the recipe site',
  manual: 'Entered by you',
  estimate: 'Estimated from the ingredients',
} as const

/**
 * The label on a recipe page: per serving, with where the numbers came from
 * said plainly. A recipe without numbers gets the two ways to give it some,
 * right there — estimate now, or type them in.
 */
export function NutritionPanel({ recipe }: { recipe: Recipe }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const estimate = async () => {
    setBusy(true)
    try {
      const result = estimateNutrition(recipe)
      if (result.matched === 0) {
        toast("MealHelp didn't recognise any of the ingredients well enough to estimate.", {
          tone: 'error',
        })
        return
      }
      await updateRecipe(recipe.id, { nutrition: result.perServing, nutritionSource: 'estimate' })
      toast(
        `Estimated from ${result.matched} of ${result.total} ingredients.${
          result.unmatched.length ? ` Not counted: ${result.unmatched.slice(0, 3).join(', ')}${result.unmatched.length > 3 ? '…' : ''}.` : ''
        }`,
        { tone: 'success' },
      )
    } finally {
      setBusy(false)
    }
  }

  if (!hasNutrition(recipe.nutrition)) {
    return (
      <section className={styles.panel}>
        <div className={styles.head}>
          <h2 className={styles.title}>Nutrition</h2>
          <span className={styles.perServing}>per serving</span>
        </div>
        <p className="text-sm muted">
          Nothing recorded yet. MealHelp can estimate it from the ingredients — an
          honest estimate, labelled as one — or you can type in what the package or
          the site says.
        </p>
        <div className="row-tight">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void estimate()} disabled={busy}>
            <Calculator size={15} aria-hidden="true" />
            {busy ? 'Estimating…' : 'Estimate from ingredients'}
          </button>
          <Link
            to={`/recipes/${recipe.id}/edit`}
            state={{ focus: 'nutrition' }}
            className="btn btn-ghost btn-sm"
          >
            <PencilLine size={15} aria-hidden="true" />
            Enter it
          </Link>
        </div>
      </section>
    )
  }

  const nutrition = recipe.nutrition
  const headline = NUTRIENTS.filter((n) => n.headline)
  const rest = NUTRIENTS.filter((n) => !n.headline && nutrition[n.key] != null)

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>Nutrition</h2>
        <span className={styles.perServing}>per serving</span>
      </div>
      <dl className={styles.headline}>
        {headline.map((nutrient) => (
          <div key={nutrient.key} className={styles.fact}>
            <dt>{nutrient.label}</dt>
            <dd>{formatNutrient(nutrient.key, nutrition[nutrient.key])}</dd>
          </div>
        ))}
      </dl>
      {rest.length ? (
        <dl className={styles.rest}>
          {rest.map((nutrient) => (
            <div key={nutrient.key} className={styles.restRow}>
              <dt>{nutrient.label}</dt>
              <dd>{formatNutrient(nutrient.key, nutrition[nutrient.key])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className={styles.source}>
        {recipe.nutritionSource === 'estimate' ? <Sparkles size={12} aria-hidden="true" /> : null}
        {SOURCE_LABEL[recipe.nutritionSource ?? 'manual']}
        {' · '}
        <Link to={`/recipes/${recipe.id}/edit`} state={{ focus: 'nutrition' }}>
          Edit
        </Link>
        {recipe.nutritionSource !== 'estimate' ? (
          <>
            {' · '}
            <button type="button" className={styles.linkButton} onClick={() => void estimate()} disabled={busy}>
              Re-estimate
            </button>
          </>
        ) : null}
      </p>
    </section>
  )
}
