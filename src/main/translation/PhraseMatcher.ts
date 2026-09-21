import type { PhraseDataset, PhraseEntry, PhraseMatch, TranslationRequest } from '../../shared/translation'
import phraseData from './data/phrases.json'

interface IndexedPhraseVariant {
  entry: PhraseEntry
  normalizedVariant: string
  tokenCount: number
}

export interface ResolvedPhraseMatch {
  entry: PhraseEntry
  match: PhraseMatch
}

export interface PhraseMatcher {
  match(contextTokens: readonly string[], clickedTokenIndex: number): ResolvedPhraseMatch | null
  readonly maxTokenCount: number
}

export const LOCAL_PHRASE_DATASET = phraseData as PhraseDataset
export const LOCAL_PHRASES: readonly PhraseEntry[] = validatePhraseDataset(LOCAL_PHRASE_DATASET)
const LOCAL_PHRASE_MATCHER = createPhraseMatcher(LOCAL_PHRASES)

export function findLocalPhraseMatch(request: TranslationRequest): ResolvedPhraseMatch | null {
  if (!request.contextTokens || request.clickedTokenIndex === undefined) {
    return null
  }

  return LOCAL_PHRASE_MATCHER.match(request.contextTokens, request.clickedTokenIndex)
}

export function createPhraseMatcher(entries: readonly PhraseEntry[]): PhraseMatcher {
  const variants = new Map<string, IndexedPhraseVariant>()
  let maxTokenCount = 0

  for (const entry of entries) {
    validatePhraseEntry(entry)

    for (const rawVariant of [entry.phrase, ...entry.forms]) {
      const normalizedVariant = normalizePhrase(rawVariant)
      const tokenCount = normalizedVariant.split(' ').length
      if (tokenCount < 2) {
        throw new Error(`Phrase variants must contain at least two tokens: ${rawVariant}`)
      }

      const existing = variants.get(normalizedVariant)
      if (existing && existing.entry !== entry) {
        throw new Error(
          `Phrase variant collision: ${normalizedVariant} (${existing.entry.phrase}, ${entry.phrase})`
        )
      }

      variants.set(normalizedVariant, { entry, normalizedVariant, tokenCount })
      maxTokenCount = Math.max(maxTokenCount, tokenCount)
    }
  }

  return {
    maxTokenCount,
    match(contextTokens, clickedTokenIndex) {
      if (
        !Number.isSafeInteger(clickedTokenIndex) ||
        clickedTokenIndex < 0 ||
        clickedTokenIndex >= contextTokens.length ||
        contextTokens.length === 0 ||
        maxTokenCount < 2
      ) {
        return null
      }

      const normalizedTokens = contextTokens.map(normalizePhraseToken)
      let best: IndexedPhraseVariant | null = null
      let bestStart = -1
      let bestEnd = -1

      const earliestStart = Math.max(0, clickedTokenIndex - maxTokenCount + 1)
      for (let start = earliestStart; start <= clickedTokenIndex; start += 1) {
        const latestEnd = Math.min(contextTokens.length, start + maxTokenCount)
        for (let end = clickedTokenIndex + 1; end <= latestEnd; end += 1) {
          const tokenCount = end - start
          if (tokenCount < 2 || tokenCount < (best?.tokenCount ?? 0)) {
            continue
          }

          const candidateTokens = normalizedTokens.slice(start, end)
          if (candidateTokens.some((token) => !token)) {
            continue
          }

          const candidate = variants.get(candidateTokens.join(' '))
          if (!candidate) {
            continue
          }

          if (
            !best ||
            candidate.tokenCount > best.tokenCount ||
            (candidate.tokenCount === best.tokenCount && start < bestStart)
          ) {
            best = candidate
            bestStart = start
            bestEnd = end
          }
        }
      }

      if (!best) {
        return null
      }

      return {
        entry: best.entry,
        match: {
          source: normalizedTokens.slice(bestStart, bestEnd).join(' '),
          startTokenIndex: bestStart,
          endTokenIndex: bestEnd
        }
      }
    }
  }
}

function validatePhraseDataset(dataset: PhraseDataset): readonly PhraseEntry[] {
  if (dataset.version !== 1 || !Array.isArray(dataset.entries)) {
    throw new Error('Phrase dataset must use schema version 1.')
  }

  const canonicalPhrases = new Set<string>()
  for (const entry of dataset.entries) {
    validatePhraseEntry(entry)
    const normalized = normalizePhrase(entry.phrase)
    if (canonicalPhrases.has(normalized)) {
      throw new Error(`Duplicate phrase headword: ${normalized}`)
    }
    canonicalPhrases.add(normalized)
  }

  return dataset.entries
}

function validatePhraseEntry(entry: PhraseEntry): void {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Phrase entries must be objects.')
  }

  const normalizedPhrase = normalizePhrase(entry.phrase)
  if (!normalizedPhrase || normalizedPhrase.split(' ').length < 2) {
    throw new Error('Phrase entries must use a multi-word phrase.')
  }

  if (!['phrasal_verb', 'idiom', 'expression'].includes(entry.type)) {
    throw new Error(`Unsupported phrase type: ${String(entry.type)}`)
  }

  if (!Array.isArray(entry.forms) || entry.forms.some((form) => !normalizePhrase(form))) {
    throw new Error(`Phrase forms are invalid for ${entry.phrase}.`)
  }

  if (
    !Array.isArray(entry.burmese) ||
    entry.burmese.length === 0 ||
    entry.burmese.length > 3 ||
    entry.burmese.some((meaning) => typeof meaning !== 'string' || !meaning.trim())
  ) {
    throw new Error(`Phrase Burmese meanings are invalid for ${entry.phrase}.`)
  }
}

function normalizePhrase(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .split(/\s+/)
    .map(normalizePhraseToken)
    .filter(Boolean)
    .join(' ')
}

function normalizePhraseToken(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}
