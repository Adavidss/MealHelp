import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardPaste, Link2, Loader2 } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { saveRecipe } from '@/db/recipes'
import type { RecipeDraft } from '@/models'
import {
  RecipeImportError,
  configureImportFetching,
  importRecipe,
  parseRecipeText,
  type RecipeImportResult,
} from '@/services/recipeImport'
import { useToast } from '@/components/common/Toast'
import { CaptureSetup } from './CaptureSetup'
import { ImportPreview } from './ImportPreview'
import styles from './ImportPage.module.css'

type Stage = 'input' | 'preview'

export function ImportPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings } = useSettings()

  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>('input')
  const [result, setResult] = useState<RecipeImportResult>()
  const [failure, setFailure] = useState<{ message: string; suggestion?: string }>()

  const runUrlImport = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!url.trim()) return

    setBusy(true)
    setFailure(undefined)
    try {
      // Whose fetcher to use is the user's choice, so it is handed over here
      // rather than read from storage deep inside the adapter.
      configureImportFetching(settings.importSettings)
      const imported = await importRecipe(url)
      setResult(imported)
      setStage('preview')
    } catch (error) {
      const failureMessage =
        error instanceof RecipeImportError
          ? { message: error.message, suggestion: error.suggestion }
          : {
              message:
                "MealHelp couldn't read that recipe. Paste the recipe text below and it will convert it.",
            }
      setFailure(failureMessage)
      // The paste box opens itself, because that is what the user has to do next.
      setShowPaste(true)
    } finally {
      setBusy(false)
    }
  }

  const runPasteImport = () => {
    if (!pasted.trim()) return
    setBusy(true)
    try {
      const parsed = parseRecipeText(pasted, url.trim() || undefined)
      setResult({
        recipe: parsed.draft,
        warnings: parsed.warnings,
        adapterId: 'text-paste',
      })
      setStage('preview')
      setFailure(undefined)
    } finally {
      setBusy(false)
    }
  }

  const save = async (draft: RecipeDraft) => {
    const saved = await saveRecipe(draft)
    toast('Recipe saved.', { tone: 'success' })
    navigate(`/recipes/${saved.id}`)
  }

  if (stage === 'preview' && result) {
    return (
      <ImportPreview
        result={result}
        onBack={() => setStage('input')}
        onSave={(draft) => void save(draft)}
        onEdit={(draft) => navigate('/recipes/new', { state: { draft } })}
      />
    )
  }

  return (
    <div className="page">
      <div className={styles.topBar}>
        <Link to="/recipes" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" />
          Recipes
        </Link>
      </div>

      <header className="page-header">
        <div>
          <h1 className="page-title">Import a recipe</h1>
          <p className="page-subtitle">
            Paste a link. If the site won't share it, paste the recipe itself.
          </p>
        </div>
      </header>

      <form onSubmit={runUrlImport}>
        <div className="field">
          <label className="field-label" htmlFor="recipe-url">
            Recipe link
          </label>
          <input
            id="recipe-url"
            type="url"
            className="input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/slow-cooker-curry"
            inputMode="url"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? (
            <Loader2 size={17} aria-hidden="true" />
          ) : (
            <Link2 size={17} aria-hidden="true" />
          )}
          {busy ? 'Reading the page…' : 'Import from link'}
        </button>
      </form>

      {failure ? (
        <div className={styles.failure} role="status">
          <p className={styles.failureMessage}>{failure.message}</p>
          {failure.suggestion ? (
            <p className={styles.failureHint}>{failure.suggestion}</p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.divider}>
        <span>or</span>
      </div>

      {showPaste ? (
        <div>
          <div className="field">
            <label className="field-label" htmlFor="paste">
              Paste the recipe
            </label>
            <span className="field-hint">
              Select the recipe on the page, copy it, and paste it here — headings
              and all. MealHelp will sort out the ingredients and directions.
            </span>
            <textarea
              id="paste"
              className={`textarea ${styles.pasteBox}`}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={
                'Slow Cooker Chicken Curry\n\nServes 6\nPrep time: 20 minutes\n\nIngredients\n2 lbs chicken thighs\n1 can coconut milk\n\nInstructions\n1. Put everything in the slow cooker.\n2. Cook on low for 6 hours.'
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={runPasteImport}
            disabled={busy || !pasted.trim()}
          >
            <ClipboardPaste size={17} aria-hidden="true" />
            Convert pasted recipe
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => setShowPaste(true)}
        >
          <ClipboardPaste size={17} aria-hidden="true" />
          Paste recipe text instead
        </button>
      )}

      <CaptureSetup />

      <section className={styles.explainer}>
        <h2 className={styles.explainerTitle}>Why some links don't work</h2>
        <p>
          MealHelp runs entirely in your browser with no server behind it. Many
          recipe sites refuse to share their pages with another site's code, and
          the largest ones turn away anything that is not a person with a
          browser — so a link alone cannot always be enough.
        </p>
        <p>
          That is what the button above is for: it reads the page you are already
          looking at, which no site can refuse. Pasting the recipe text works just
          as well and needs no setup at all.
        </p>
        <p className="text-sm faint">Everything you import stays on this device.</p>
      </section>

      <div className={styles.manual}>
        <Link to="/recipes/new" className="btn btn-ghost">
          Type a recipe in by hand
        </Link>
      </div>
    </div>
  )
}
