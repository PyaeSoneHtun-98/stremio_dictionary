import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import { LEGACY_COMPATIBILITY_ALIASES } from './legacyCompatibilityAliases'
import type { TranslationProvider } from './TranslationProvider'
import { LOCAL_DICTIONARY, type LocalDictionaryEntry } from './localDictionary'

// The production corpus plus the small structured core supplement are immutable for the lifetime
// of the Electron main process. Build the lookup index once at module load.
const STRUCTURED_DICTIONARY_INDEX = buildDictionaryIndex(
  LOCAL_DICTIONARY,
  LEGACY_COMPATIBILITY_ALIASES
)

export class LocalDictionaryProvider implements TranslationProvider {
  readonly id = 'local-dictionary'

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const originalWord = request.word.trim()
    if (!originalWord) {
      throw new Error('Choose a subtitle word to translate.')
    }

    const targetLanguage = request.targetLanguage ?? 'my'
    if (targetLanguage !== 'my') {
      throw new Error('The offline dictionary currently supports Burmese (my) only.')
    }

    const lookupWord = normalizeLookupWord(originalWord)
    const entry = STRUCTURED_DICTIONARY_INDEX.get(lookupWord)
    if (entry) {
      return {
        originalWord,
        translation: flattenBurmeseMeanings(entry),
        pronunciation: entry.pronunciation,
        dictionaryEntry: entry,
        provider: this.id,
        targetLanguage
      }
    }

    throw new Error(`No offline Burmese translation is available for “${originalWord}” yet.`)
  }
}

function buildDictionaryIndex(
  dictionary: readonly LocalDictionaryEntry[],
  compatibilityAliases: Readonly<Record<string, readonly string[]>>
): ReadonlyMap<string, LocalDictionaryEntry> {
  const index = new Map<string, LocalDictionaryEntry>()
  const headwords = new Map<string, LocalDictionaryEntry>()

  // Register every canonical headword first so an exact dictionary entry always wins over another
  // entry's inflected form or compatibility alias.
  for (const entry of dictionary) {
    addHeadwordKey(index, entry.word, entry)
    headwords.set(normalizeLookupWord(entry.word), entry)
  }

  for (const entry of dictionary) {
    for (const form of entry.forms) {
      addLookupAlias(index, form, entry, 'form')
    }
  }

  // Compatibility aliases restore a small set of lookups that the old starter dictionary
  // supported but the frozen v1 corpus intentionally does not store as forms. The frozen JSON
  // remains byte-for-byte unchanged.
  for (const [headword, aliases] of Object.entries(compatibilityAliases)) {
    const normalizedHeadword = normalizeLookupWord(headword)
    const entry = headwords.get(normalizedHeadword)
    if (!entry) {
      throw new Error(`Local dictionary compatibility target is missing: ${normalizedHeadword}`)
    }

    for (const alias of aliases) {
      addLookupAlias(index, alias, entry, 'compatibility alias')
    }
  }

  return index
}

function addHeadwordKey(
  index: Map<string, LocalDictionaryEntry>,
  word: string,
  entry: LocalDictionaryEntry
): void {
  const normalized = normalizeLookupWord(word)
  if (!normalized) {
    throw new Error('Local dictionary entries must use a non-empty word.')
  }

  const existing = index.get(normalized)
  if (existing && existing !== entry) {
    throw new Error(`Duplicate local dictionary headword: ${normalized}`)
  }

  index.set(normalized, entry)
}

function addLookupAlias(
  index: Map<string, LocalDictionaryEntry>,
  alias: string,
  entry: LocalDictionaryEntry,
  kind: 'form' | 'compatibility alias'
): void {
  const normalized = normalizeLookupWord(alias)
  if (!normalized) {
    throw new Error(`Local dictionary ${kind}s must use a non-empty word.`)
  }

  const existing = index.get(normalized)
  if (existing) {
    const existingIsExactHeadword = normalizeLookupWord(existing.word) === normalized
    if (existingIsExactHeadword) {
      return
    }
    if (existing !== entry) {
      throw new Error(
        `Duplicate local dictionary ${kind}: ${normalized} (${existing.word}, ${entry.word})`
      )
    }
  }

  index.set(normalized, entry)
}

function flattenBurmeseMeanings(entry: LocalDictionaryEntry): string {
  return entry.meanings.flatMap((meaning) => meaning.burmese).join('၊ ')
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
