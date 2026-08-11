import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { saveRecipe } from '@/db/recipes'
import type { RecipeDraft } from '@/models'
import {
  RecipeImportError,
  captureToDraft,
  decodeCapture,
} from '@/services/recipeImport'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from './ImportPreview'

/**
 * Where the MealHelp button lands. The recipe travelled inside the link, so
 * there is nothing to fetch and nothing that can be refused — by the time this
 * renders, the recipe is already in hand and only needs looking over.
 */
export function CapturePage() {
  const { payload } = useParams<{ payload: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const captured = useMemo(() => {
    if (!payload) {
      return { error: 'That link had nothing in it.' }
    }
    try {
      return { value: captureToDraft(decodeCapture(payload)) }
    } catch (error) {
      return {
        error:
          error instanceof RecipeImportError
            ? error.message
            : 'That link could not be read.',
        suggestion: error instanceof RecipeImportError ? error.suggestion : undefined,
      }
    }
  }, [payload])

  const save = async (draft: RecipeDraft) => {
    setSaving(true)
    try {
      const saved = await saveRecipe(draft)
      toast(`Saved ${saved.title}.`, { tone: 'success' })
      navigate(`/recipes/${saved.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  if ('error' in captured && captured.error) {
    return (
      <div className="page">
        <h1 className="page-title">Captured recipe</h1>
        <p>{captured.error}</p>
        {captured.suggestion ? <p className="muted">{captured.suggestion}</p> : null}
        <div className="row-tight" style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/import" className="btn btn-primary">
            Back to import
          </Link>
        </div>
      </div>
    )
  }

  const result = captured.value
  if (!result) return null

  return (
    <ImportPreview
      result={{
        recipe: result.draft,
        warnings: result.warnings,
        adapterId: 'page-capture',
      }}
      onBack={() => navigate('/import')}
      onSave={(draft) => void (!saving && save(draft))}
      onEdit={(draft) => navigate('/recipes/new', { state: { draft } })}
    />
  )
}
