import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, Link2, RefreshCw, Send, Unlink, Users } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useToast } from '@/components/common/Toast'
import type { HouseholdLink } from '@/models'
import { formatCode } from '@/services/sync/crypto'
import {
  clearHousehold,
  createHousehold,
  householdInviteLink,
  joinHousehold,
  loadHousehold,
  syncNow,
} from '@/services/sync/household'
import styles from './HouseholdPanel.module.css'

/**
 * Two people, one kitchen.
 *
 * The whole of linking is a code: one phone makes one, the other types it in,
 * and from then on both push what they have and take what the other left.
 * There is no account to make and nothing to sign into, which is the only
 * reason this can exist in an app with no server.
 *
 * The code is deliberately shown in full rather than hidden behind a button.
 * It is the one thing that has to travel between two people, and it is also
 * the one thing worth being careful with — so the warning sits next to it.
 */
export function HouseholdPanel() {
  const { reload } = useSettings()
  const { toast } = useToast()
  const [link, setLink] = useState<HouseholdLink | undefined>(() => loadHousehold())
  const [entering, setEntering] = useState(false)
  const [typedCode, setTypedCode] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [params, setParams] = useSearchParams()

  const runSync = async (quiet = false) => {
    setSyncing(true)
    try {
      const outcome = await syncNow()
      setLink(loadHousehold())
      // Shared meal slots and planning defaults live in settings, which the
      // rest of the app reads through a context rather than the database.
      await reload()
      if (outcome.status === 'ok') {
        const changed = outcome.written + outcome.deleted
        if (!quiet || changed > 0) {
          toast(changed > 0 ? `Synced — ${changed} ${changed === 1 ? 'change' : 'changes'} from the other phone` : 'Synced — everything already matched')
        }
      } else if (outcome.status !== 'no-link' && !quiet) {
        toast(outcome.message ?? 'Could not sync', { tone: 'error' })
      }
    } finally {
      setSyncing(false)
    }
  }

  /*
   * Opening an invite link is the join: the code is in the fragment, so it
   * never reached a web server on the way here. It is taken out of the address
   * bar straight away so a shared screenshot of the URL is not a house key.
   */
  const joinedFromLink = useRef(false)
  useEffect(() => {
    const invite = params.get('join')
    if (!invite || joinedFromLink.current) return
    joinedFromLink.current = true
    params.delete('join')
    setParams(params, { replace: true })
    try {
      setLink(joinHousehold(invite))
      toast('Linked. Syncing your kitchens…')
      void runSync()
    } catch {
      toast('That invite link is not a household code', { tone: 'error' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const start = () => {
    setLink(createHousehold())
    void runSync(true)
  }

  const join = () => {
    try {
      setLink(joinHousehold(typedCode))
      setEntering(false)
      setTypedCode('')
      void runSync()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That code did not work', { tone: 'error' })
    }
  }

  const copyCode = async () => {
    if (!link) return
    await navigator.clipboard.writeText(formatCode(link.code))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /** The same wording either way, so a text and a shared link read alike. */
  const sendInvite = async () => {
    if (!link) return
    const text = `Let's plan meals together in MealHelp. Open this on your phone and we'll share the same recipes, week and shopping list:\n\n${householdInviteLink(link)}\n\n(Or type the code in Settings: ${formatCode(link.code)})`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cook together in MealHelp', text })
        return
      } catch {
        // Cancelled, or unavailable: fall through to a plain text message.
      }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`
  }

  const unlink = () => {
    clearHousehold()
    setLink(undefined)
    setConfirmUnlink(false)
    // Nothing is deleted: both phones keep everything they had when linked.
    toast('This phone is on its own again. Nothing was deleted.')
  }

  if (!link) {
    return (
      <div className={styles.panel}>
        <p className="text-sm muted">
          Link another phone and you will both see the same recipes, the same
          planned week, and the same shopping list — ticking something off in
          the shop shows up on the other phone.
        </p>
        {entering ? (
          <div className={styles.joinRow}>
            <input
              className="input"
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value)}
              placeholder="abcd-efgh-jkmn-pqrs"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Household code"
            />
            <button type="button" className="btn btn-primary" onClick={join}>
              Join
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEntering(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" onClick={start}>
              <Users size={17} aria-hidden="true" />
              Start a household
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEntering(true)}>
              <Link2 size={17} aria-hidden="true" />
              I have a code
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.codeCard}>
        <span className={styles.codeLabel}>Household code</span>
        <button type="button" className={styles.code} onClick={() => void copyCode()}>
          {formatCode(link.code)}
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
        <p className={styles.warning}>
          Anyone with this code can read and change your kitchen. Send it the
          way you would a spare key — to people, not to the internet.
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={() => void sendInvite()}>
          <Send size={17} aria-hidden="true" />
          Send an invite
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void runSync()}
          disabled={syncing}
        >
          <RefreshCw size={17} aria-hidden="true" className={syncing ? styles.spinning : undefined} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <p className="text-sm muted">
        {link.lastSyncedAt
          ? `Last synced ${new Date(link.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. Syncs again whenever you open MealHelp.`
          : 'Not synced yet.'}
      </p>

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmUnlink(true)}>
        <Unlink size={16} aria-hidden="true" />
        Unlink this phone
      </button>

      <ConfirmDialog
        open={confirmUnlink}
        title="Unlink this phone?"
        message="This phone stops sharing with the household. Everything already on it stays exactly as it is, and so does everything on the other phone."
        confirmLabel="Unlink"
        onConfirm={unlink}
        onCancel={() => setConfirmUnlink(false)}
      />
    </div>
  )
}
