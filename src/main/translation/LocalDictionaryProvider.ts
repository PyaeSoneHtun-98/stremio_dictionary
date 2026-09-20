import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import type { TranslationProvider } from './TranslationProvider'
import { LOCAL_DICTIONARY, type LocalDictionaryEntry } from './localDictionary'

// The production corpus plus the small structured core supplement are immutable for the lifetime
// of the Electron main process. Build the lookup index once at module load.
const STRUCTURED_DICTIONARY_INDEX = buildDictionaryIndex(LOCAL_DICTIONARY)

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
  dictionary: readonly LocalDictionaryEntry[]
): ReadonlyMap<string, LocalDictionaryEntry> {
  const index = new Map<string, LocalDictionaryEntry>()

  // Register every canonical headword first so an exact dictionary entry always wins over another
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

function flattenBurmeseMeanings(entry: LocalDictionaryEntry): string {
  return entry.meanings.flatMap((meaning) => meaning.burmese).join('၊ ')
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
