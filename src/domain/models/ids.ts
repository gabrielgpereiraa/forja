export type ID = string

export function createId(prefix = ''): ID {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18)
  return prefix ? `${prefix}_${random}` : random
}
