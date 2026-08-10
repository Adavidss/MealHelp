import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  value: string
  size?: number
  label?: string
  className?: string
}

/**
 * Rendered as an SVG data URL rather than a canvas, because the printed sheet
 * is the whole point of these codes and canvases print at screen resolution.
 */
export function QRCode({ value, size = 96, label, className }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)

    QRCodeLib.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((svg) => {
        if (cancelled) return
        setDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [value])

  if (failed) {
    return (
      <span className="text-sm faint">
        This is too much information for one QR code.
      </span>
    )
  }

  if (!dataUrl) {
    return <span style={{ width: size, height: size, display: 'inline-block' }} />
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label ?? 'QR code'}
      className={className}
      style={{ background: '#fff', padding: 4, borderRadius: 6 }}
    />
  )
}
