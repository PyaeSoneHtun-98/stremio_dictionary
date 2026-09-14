import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import type { TranslationProvider } from './TranslationProvider'
import { LOCAL_DICTIONARY, type LocalDictionaryEntry } from './localDictionary'

export class LocalDictionaryProvider implements TranslationProvider {
  readonly id = 'local-dictionary'
  private readonly index = buildDictionaryIndex(LOCAL_DICTIONARY)

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
    const entry = this.index.get(lookupWord)
    if (!entry) {
      throw new Error(`No offline Burmese translation is available for “${originalWord}” yet.`)
    }

    return {
      originalWord,
      translation: flattenBurmeseMeanings(entry),
      pronunciation: entry.pronunciation,
      dictionaryEntry: entry,
      provider: this.id,
      targetLanguage
    }
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

function flattenBurmeseMeanings(entry: LocalDictionaryEntry): string {
  return entry.meanings.flatMap((meaning) => meaning.burmese).join('၊ ')
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
