/**
 * Ids are generated on the device and must survive being merged with a backup
 * taken on another device, so they are random rather than sequential.
 */
export function newId(prefix = ''): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${raw}` : raw
}

export function nowISO(): string {
  return new Date().toISOString()
}
