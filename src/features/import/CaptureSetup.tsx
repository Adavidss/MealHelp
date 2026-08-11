import { useState } from 'react'
import { Check, Copy, Smartphone } from 'lucide-react'
import { buildBookmarklet, buildCaptureScript, currentAppUrl } from '@/services/recipeImport'
import { useToast } from '@/components/common/Toast'
import styles from './CaptureSetup.module.css'

/**
 * Sets up the one route that works on every site.
 *
 * Sites can refuse MealHelp's requests, and the bigger ones refuse anything
 * that is not a person with a browser. This hands the reading job to the
 * browser the user is already holding, which nothing can refuse. It is a
 * one-time setup, and two taps every time after that.
 */
export function CaptureSetup() {
  const { toast } = useToast()
  const [copied, setCopied] = useState<string>()
  const appUrl = currentAppUrl()

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(undefined), 2500)
      toast('Copied.', { tone: 'success' })
    } catch {
      toast('Your browser blocked the clipboard — select the text and copy it.', {
        tone: 'error',
      })
    }
  }

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Import from any site</h2>
      <p className={styles.lead}>
        Some recipe sites refuse to hand their pages to anything but a person
        with a browser. The way past that is to let your browser do the reading:
        open the recipe as normal, then tap a button that sends it here.
      </p>

      <div className={styles.method}>
        <h3 className={styles.methodTitle}>
          <Smartphone size={16} aria-hidden="true" />
          iPhone and iPad
        </h3>
        <ol className={styles.steps}>
          <li>Open the Shortcuts app and make a new shortcut.</li>
          <li>
            Turn on <strong>Show in Share Sheet</strong>, and set it to accept
            <strong> Safari web pages</strong>.
          </li>
          <li>
            Add the action <strong>Run JavaScript on Web Page</strong> and paste
            the script below into it.
          </li>
          <li>
            Name it <strong>Add to MealHelp</strong>.
          </li>
        </ol>
        <p className={styles.after}>
          From then on: open a recipe in Safari, tap Share, tap{' '}
          <strong>Add to MealHelp</strong>. The recipe opens here ready to save.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => void copy('script', buildCaptureScript(appUrl))}
        >
          {copied === 'script' ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Copy size={17} aria-hidden="true" />
          )}
          {copied === 'script' ? 'Script copied' : 'Copy the shortcut script'}
        </button>
      </div>

      <div className={styles.method}>
        <h3 className={styles.methodTitle}>Computer</h3>
        <p className={styles.lead}>
          Make a new bookmark on your bookmarks bar, call it{' '}
          <strong>Add to MealHelp</strong>, and paste this as the address. Then
          click it whenever you are on a recipe.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void copy('bookmarklet', buildBookmarklet(appUrl))}
        >
          {copied === 'bookmarklet' ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Copy size={17} aria-hidden="true" />
          )}
          {copied === 'bookmarklet' ? 'Bookmark copied' : 'Copy the bookmark address'}
        </button>
      </div>

      <p className={styles.footnote}>
        Nothing is sent anywhere: the recipe travels from the page into MealHelp
        inside the link itself.
      </p>
    </section>
  )
}
