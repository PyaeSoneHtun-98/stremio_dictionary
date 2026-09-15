import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import type { TranslationProvider } from './TranslationProvider'
import {
  LEGACY_LOCAL_DICTIONARY,
  type LegacyLocalDictionaryEntry
} from './legacyDictionary'
import { LOCAL_DICTIONARY, type LocalDictionaryEntry } from './localDictionary'

// These indexes are immutable for the lifetime of the Electron main process. Build them once at
// module load instead of once per provider instance/cache miss; the structured corpus is expected
// to grow to roughly 30,000 headwords plus inflected forms.
const STRUCTURED_DICTIONARY_INDEX = buildDictionaryIndex(LOCAL_DICTIONARY)
const LEGACY_DICTIONARY_INDEX = buildLegacyDictionaryIndex(LEGACY_LOCAL_DICTIONARY)

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

    const legacyEntry = LEGACY_DICTIONARY_INDEX.get(lookupWord)
    if (legacyEntry) {
      return {
        originalWord,
        translation: legacyEntry.translation,
        ...(legacyEntry.pronunciation ? { pronunciation: legacyEntry.pronunciation } : {}),
        provider: this.id,
        targetLanguage
      }
    }

    throw new Error(`No offline Burmese translation is available for “${originalWord}” yet.`)
  }
}

function buildDictionaryIndex(
  dictionary: readonly LocalDictionaryEntry[]
): ReadonlyMap<string, LocalDictionaryEntry> {
  const index = new Map<string, LocalDictionaryEntry>()

  // Register canonical headwords first so an exact dictionary entry always wins over another
  // entry's inflected form (for example: warn -> warning, while warning is also a headword).
  for (const entry of dictionary) {
    addHeadwordKey(index, entry.word, entry)
  }

  for (const entry of dictionary) {
    for (const form of entry.forms) {
      addFormKey(index, form, entry)
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

function addFormKey(
  index: Map<string, LocalDictionaryEntry>,
  form: string,
  entry: LocalDictionaryEntry
): void {
  const normalized = normalizeLookupWord(form)
  if (!normalized) {
    throw new Error('Local dictionary forms must use a non-empty word.')
  }

  const existing = index.get(normalized)
  if (existing) {
    const existingIsExactHeadword = normalizeLookupWord(existing.word) === normalized
    if (existingIsExactHeadword) {
      return
    }
    if (existing !== entry) {
      throw new Error(
        `Duplicate local dictionary form: ${normalized} (${existing.word}, ${entry.word})`
      )
    }
  }

  index.set(normalized, entry)
}

function buildLegacyDictionaryIndex(
  dictionary: Readonly<Record<string, LegacyLocalDictionaryEntry>>
): ReadonlyMap<string, LegacyLocalDictionaryEntry> {
  const index = new Map<string, LegacyLocalDictionaryEntry>()

  for (const [headword, entry] of Object.entries(dictionary)) {
    addLegacyDictionaryKey(index, headword, entry)
    for (const alias of entry.aliases ?? []) {
      addLegacyDictionaryKey(index, alias, entry)
    }
  }

  return index
}

function addLegacyDictionaryKey(
  index: Map<string, LegacyLocalDictionaryEntry>,
  word: string,
  entry: LegacyLocalDictionaryEntry
): void {
  const normalized = normalizeLookupWord(word)
  if (!normalized) {
    throw new Error('Legacy local dictionary entries must use a non-empty word.')
  }

  const existing = index.get(normalized)
  if (existing && existing !== entry) {
    throw new Error(`Duplicate legacy local dictionary word: ${normalized}`)
  }

  index.set(normalized, entry)
}

function flattenBurmeseMeanings(entry: LocalDictionaryEntry): string {
  return entry.meanings.flatMap((meaning) => meaning.burmese).join('၊ ')
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
