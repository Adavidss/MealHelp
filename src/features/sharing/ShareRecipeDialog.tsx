import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import type { Recipe } from '@/models'
import { describeShare, recipePayload } from '@/services/shareCodec'
import { Modal } from '@/components/common/Modal'
import { QRCode } from '@/components/common/QRCode'
import { useToast } from '@/components/common/Toast'
import styles from './ShareDialog.module.css'

interface ShareRecipeDialogProps {
  open: boolean
  recipe: Recipe
  onClose: () => void
}

export function ShareRecipeDialog({ open, recipe, onClose }: ShareRecipeDialogProps) {
  const { toast } = useToast()
  const share = useMemo(() => describeShare(recipePayload(recipe)), [recipe])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url)
      toast('Link copied.', { tone: 'success' })
    } catch {
      toast('Your browser blocked the clipboard.', { tone: 'error' })
    }
  }

  return (
    <Modal open={open} title="Share recipe" onClose={onClose}>
      <p className="text-sm muted">
        The recipe travels inside the link. Whoever opens it sees it in MealHelp's
        format and can save it to their own library.
      </p>

      <div className={styles.qrWrap}>
        {share.qrSafe ? (
          <QRCode value={share.url} size={188} label={`Scan to open ${recipe.title}`} />
        ) : (
          <p className={styles.tooBig}>
            This recipe is too long to fit in a QR code. Copy the link instead —
            links have no size limit.
          </p>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          <Copy size={16} aria-hidden="true" />
          Copy link
        </button>
        {recipe.sourceUrl ? (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            Original recipe
          </a>
        ) : null}
      </div>
    </Modal>
  )
}
