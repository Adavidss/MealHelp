import { useMemo, useState } from 'react'
import { Copy, MessageSquare } from 'lucide-react'
import type { GroceryList } from '@/models'
import { groceryListToText } from '@/db/grocery'
import {
  describeShare,
  groceryPayload,
  unpurchasedOnly,
} from '@/services/shareCodec'
import { formatWeekRange } from '@/utils/date'
import { Modal } from '@/components/common/Modal'
import { QRCode } from '@/components/common/QRCode'
import { useToast } from '@/components/common/Toast'
import styles from './ShareDialog.module.css'

interface ShareGroceryDialogProps {
  open: boolean
  list: GroceryList
  onClose: () => void
}

/**
 * The whole list travels inside the link. When it will not fit in a scannable
 * QR code, MealHelp says so and offers the shopping that is actually left —
 * rather than drawing a code nobody's camera can read.
 */
export function ShareGroceryDialog({ open, list, onClose }: ShareGroceryDialogProps) {
  const { toast } = useToast()
  const [remainingOnly, setRemainingOnly] = useState(false)

  const share = useMemo(() => {
    const items = remainingOnly ? unpurchasedOnly(list) : list.items
    return describeShare(groceryPayload(items, list.weekStart))
  }, [list, remainingOnly])

  /**
   * The list as a message: the words, then the link.
   *
   * The words matter more than the link — most people will read it in the
   * shop rather than open it — so the text leads and the link follows for
   * whoever wants the tickable version.
   */
  const messageText = () => {
    const items = remainingOnly ? unpurchasedOnly(list) : list.items
    const lines = groceryListToText({ ...list, items })
    return `Shopping list — ${formatWeekRange(list.weekStart)}\n\n${lines}\n\nTickable version: ${share.url}`
  }

  const sendAsText = async () => {
    const text = messageText()
    // The share sheet reaches Messages, WhatsApp and the rest; where there is
    // none, sms: opens the messaging app with the list already written.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shopping list', text })
        return
      } catch {
        // Dismissed, or refused: fall through to the sms: link rather than
        // leaving the tap doing nothing.
      }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`
  }

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(message, { tone: 'success' })
    } catch {
      toast('Your browser blocked the clipboard. Select the text and copy it.', {
        tone: 'error',
      })
    }
  }

  return (
    <Modal open={open} title="Share grocery list" onClose={onClose}>
      <p className="text-sm muted">
        The list is packed into the link itself, so the other device does not need
        an account and nothing is uploaded anywhere.
      </p>

      <div className={styles.qrWrap}>
        {share.qrSafe ? (
          <QRCode value={share.url} size={188} label="Scan to open this grocery list" />
        ) : (
          <div className={styles.tooBig}>
            <p>
              This list is too long to fit in a QR code that will scan reliably.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRemainingOnly(true)}
            >
              Share only what's left to buy
            </button>
          </div>
        )}
      </div>

      {share.size === 'large' && share.qrSafe ? (
        <p className={styles.warning}>
          This is a big list — the code may need a steady hand to scan.
        </p>
      ) : null}

      <div className="field">
        <button
          type="button"
          className="chip chip-button"
          aria-pressed={remainingOnly}
          onClick={() => setRemainingOnly((current) => !current)}
        >
          Only what's still to buy
        </button>
      </div>

      <div className={styles.actions}>
        {/*
          The way a list actually gets to somebody: a text message. The share
          sheet is offered first where the platform has one, because it reaches
          Messages, WhatsApp and everything else the phone knows about; the
          sms: link is the fallback for browsers that have no share sheet.
        */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void sendAsText()}
        >
          <MessageSquare size={16} aria-hidden="true" />
          Send as a text
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void copy(share.url, 'Link copied.')}
        >
          <Copy size={16} aria-hidden="true" />
          Copy link
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void copy(messageText(), 'List copied as text.')}
        >
          <Copy size={16} aria-hidden="true" />
          Copy as text
        </button>
      </div>
    </Modal>
  )
}
