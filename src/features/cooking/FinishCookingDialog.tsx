import { useEffect, useState } from 'react'
import { recordCookEvent, recordFeedback } from '@/db/cookEvents'
import { updatePlannedMeal } from '@/db/plans'
import {
  FEEDBACK_TAGS,
  FEEDBACK_TAG_LABELS,
  FEEDBACK_VERDICTS,
  FEEDBACK_VERDICT_LABELS,
  type FeedbackTag,
  type FeedbackVerdict,
  type Recipe,
} from '@/models'
import { Modal } from '@/components/common/Modal'
import { StarRating } from '@/components/common/StarRating'
import { useToast } from '@/components/common/Toast'
import styles from './FinishCookingDialog.module.css'

interface FinishCookingDialogProps {
  open: boolean
  recipe: Recipe
  defaultServings: number
  plannedMealId?: string
  onClose: () => void
  onDone: () => void
}

/**
 * Two things happen here, and only one of them is required: recording what was
 * made — which is what makes leftovers real — and saying how it went, which is
 * always optional. Nobody should have to rate a meal to close a dialog.
 */
export function FinishCookingDialog({
  open,
  recipe,
  defaultServings,
  plannedMealId,
  onClose,
  onDone,
}: FinishCookingDialogProps) {
  const { toast } = useToast()
  const [made, setMade] = useState(defaultServings)
  const [eaten, setEaten] = useState(Math.min(2, defaultServings))
  const [verdict, setVerdict] = useState<FeedbackVerdict>()
  const [rating, setRating] = useState<number>()
  const [tags, setTags] = useState<FeedbackTag[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setMade(defaultServings)
      setEaten(Math.min(2, defaultServings))
    }
  }, [open, defaultServings])

  const leftovers = Math.max(0, made - eaten)

  const save = async () => {
    setSaving(true)
    try {
      const event = await recordCookEvent({
        recipe,
        servingsMade: made,
        servingsConsumed: eaten,
        plannedMealId,
      })

      if (verdict || rating != null || tags.length) {
        await recordFeedback({
          recipeId: recipe.id,
          cookEventId: event.id,
          verdict,
          rating,
          tags,
        })
      }

      if (plannedMealId) {
        await updatePlannedMeal(plannedMealId, { sourceCookEventId: event.id })
      }

      toast(
        leftovers > 0
          ? `Logged. ${leftovers} serving${leftovers === 1 ? '' : 's'} of ${recipe.title} left over.`
          : 'Logged.',
        { tone: 'success' },
      )
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="How did it go?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Servings made</span>
        <Stepper value={made} onChange={setMade} min={1} label="servings made" />
      </div>

      <div className="field">
        <span className="field-label">Eaten tonight</span>
        <Stepper value={eaten} onChange={setEaten} min={0} max={made} label="servings eaten" />
        <span className="field-hint">
          {leftovers > 0
            ? `${leftovers} serving${leftovers === 1 ? '' : 's'} will be available as leftovers.`
            : 'No leftovers from this one.'}
        </span>
      </div>

      <hr className="divider" />

      <div className="field">
        <span className="field-label">Verdict (optional)</span>
        <div className="row-tight">
          {FEEDBACK_VERDICTS.map((option) => (
            <button
              key={option}
              type="button"
              className="chip chip-button"
              aria-pressed={verdict === option}
              onClick={() => setVerdict(verdict === option ? undefined : option)}
            >
              {FEEDBACK_VERDICT_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Rating (optional)</span>
        <StarRating value={rating} onChange={setRating} label="Rating" />
      </div>

      <div className="field">
        <span className="field-label">Anything else?</span>
        <div className="row-tight">
          {FEEDBACK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip chip-button"
              aria-pressed={tags.includes(tag)}
              onClick={() =>
                setTags((current) =>
                  current.includes(tag)
                    ? current.filter((t) => t !== tag)
                    : [...current, tag],
                )
              }
            >
              {FEEDBACK_TAG_LABELS[tag]}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`One fewer ${label}`}
        disabled={value <= min}
      >
        −
      </button>
      <span className={styles.value}>{value}</span>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={`One more ${label}`}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  )
}
