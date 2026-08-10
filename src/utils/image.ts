/**
 * Uploaded photos are resized before they are stored.
 *
 * IndexedDB is the user's own disk, and a library of 300 recipes each carrying
 * a 4 MB phone photo is a real problem on a phone. Imported recipes keep a
 * remote URL instead and cost nothing at all.
 */
const MAX_EDGE = 1280
const QUALITY = 0.72
export const MAX_IMAGE_BYTES = 600_000

export interface ResizeResult {
  dataUrl: string
  bytes: number
  width: number
  height: number
}

export async function resizeImageFile(file: File): Promise<ResizeResult> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not process the image.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  let quality = QUALITY
  let dataUrl = canvas.toDataURL('image/jpeg', quality)

  // Step the quality down rather than refusing a large photo outright.
  while (estimateBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.35) {
    quality -= 0.12
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  return { dataUrl, bytes: estimateBytes(dataUrl), width, height }
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}
