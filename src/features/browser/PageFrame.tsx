import { useCallback, useEffect, useRef, type RefObject } from 'react'
import styles from './PageFrame.module.css'

interface PageFrameProps {
  html: string
  /** What relative links and form actions resolve against. */
  pageUrl: string
  title: string
  onNavigate: (url: string) => void
  frameRef?: RefObject<HTMLIFrameElement | null>
}

/**
 * The frame the page is shown in.
 *
 * Sandboxed with scripts off and forms allowed, and same-origin so MealHelp
 * can see into it. Same-origin sounds alarming, but nothing in the frame can
 * act: no script runs, no popup opens, no navigation escapes to the top. What
 * it buys is that every link and search box on the page can be routed back
 * through MealHelp's own loader — which is what makes it a browser rather
 * than a picture of a page.
 */
export function PageFrame({ html, pageUrl, title, onNavigate, frameRef }: PageFrameProps) {
  const localRef = useRef<HTMLIFrameElement>(null)
  const ref = frameRef ?? localRef
  const navigateRef = useRef(onNavigate)
  navigateRef.current = onNavigate
  const pageUrlRef = useRef(pageUrl)
  pageUrlRef.current = pageUrl

  const wire = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc) return

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      // Nothing inside the frame may navigate on its own: the frame's own
      // address is about:srcdoc, and letting it go anywhere else would take it
      // out of MealHelp's reach.
      event.preventDefault()
      const href = anchor.getAttribute('href') ?? ''
      let resolved: URL
      try {
        resolved = new URL(href, doc.baseURI || pageUrlRef.current)
      } catch {
        return
      }
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return

      // A link to a spot on this same page: scroll there rather than reload.
      const here = new URL(pageUrlRef.current)
      if (
        resolved.hash &&
        resolved.origin === here.origin &&
        resolved.pathname === here.pathname &&
        resolved.search === here.search
      ) {
        const id = decodeURIComponent(resolved.hash.slice(1))
        const spot =
          doc.getElementById(id) ?? doc.querySelector(`a[name="${CSS.escape(id)}"]`)
        spot?.scrollIntoView({ block: 'start' })
        return
      }

      navigateRef.current(resolved.toString())
    }

    // Site search boxes and filters are ordinary GET forms; sending them
    // through the loader makes them work. Anything that posts is left alone —
    // there is nothing useful a comment form could do here.
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault()
      const form = event.target as HTMLFormElement | null
      if (!form) return
      if ((form.getAttribute('method') ?? 'get').toLowerCase() !== 'get') return

      let action: URL
      try {
        action = new URL(form.getAttribute('action') ?? '', doc.baseURI || pageUrlRef.current)
      } catch {
        return
      }
      if (action.protocol !== 'http:' && action.protocol !== 'https:') return

      const params = new URLSearchParams()
      const data = new FormData(form, event.submitter ?? undefined)
      for (const [key, value] of data) {
        if (typeof value === 'string') params.append(key, value)
      }
      action.search = params.toString()
      navigateRef.current(action.toString())
    }

    doc.addEventListener('click', onClick, true)
    doc.addEventListener('submit', onSubmit, true)
    return () => {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('submit', onSubmit, true)
    }
  }, [ref])

  const cleanup = useRef<(() => void) | undefined>(undefined)

  const handleLoad = useCallback(() => {
    cleanup.current?.()
    cleanup.current = wire()
  }, [wire])

  useEffect(() => () => cleanup.current?.(), [])

  return (
    <iframe
      ref={ref}
      className={styles.frame}
      title={title}
      // Same origin so the page can be read and its links routed; no scripts,
      // no popups, no navigating the app. Forms only so that site search works.
      sandbox="allow-same-origin allow-forms"
      srcDoc={html}
      onLoad={handleLoad}
      referrerPolicy="no-referrer"
    />
  )
}
