import { createContext, use, useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Toast.module.css'

interface Toast {
  id: number
  message: string
  tone: 'default' | 'success' | 'error'
  action?: { label: string; run: () => void }
}

interface ToastContextValue {
  toast: (
    message: string,
    options?: { tone?: Toast['tone']; action?: Toast['action'] },
  ) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VISIBLE_MS = 4200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const toast = useCallback<ToastContextValue['toast']>((message, options) => {
    const id = nextId.current++
    setToasts((current) => [
      ...current,
      { id, message, tone: options?.tone ?? 'default', action: options?.action },
    ])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, VISIBLE_MS)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext value={value}>
      {children}
      {/* Announced politely so a confirmation never interrupts a screen reader
          mid-sentence while cooking. */}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`}>
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  t.action?.run()
                  setToasts((current) => current.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const ctx = use(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
