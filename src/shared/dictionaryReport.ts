export type DictionaryReportCategory = 'missing' | 'incorrect'

export interface DictionaryReportRequest {
  term: string
  category: DictionaryReportCategory
}

export type DictionaryReportOutcome =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'invalid' | 'rate-limited' | 'failed' }

// Base v1.0 + batches 061–070 + reviewed app corrections revision 1.
// Uses the existing backend's bounded version syntax; no contract expansion is needed.
export const REPORT_DICTIONARY_VERSION = '1.0-ext.061-070.1'
export const REPORT_PHRASE_DICTIONARY_VERSION = '1.0.0'

export function normalizeDictionaryReport(value: unknown): DictionaryReportRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const fields = value as Record<string, unknown>
  if (Object.keys(fields).some((key) => key !== 'term' && key !== 'category')) return null
  if (typeof fields.term !== 'string' || fields.term.length > 120) return null
  if (fields.category !== 'missing' && fields.category !== 'incorrect') return null
  const term = fields.term.normalize('NFKC').trim().toLowerCase().replace(/ +/g, ' ')
  if (
    !term ||
    term.length > 120 ||
    term.split(' ').length > 5 ||
    !/^[\p{L}\p{N}][\p{L}\p{N}'’ .-]*$/u.test(term)
  )
    return null
  return { term, category: fields.category }
}
