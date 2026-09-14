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

  for (const entry of dictionary) {
    addDictionaryKey(index, entry.word, entry)
    for (const form of entry.forms) {
      addDictionaryKey(index, form, entry)
    }
  }

  return index
}

function addDictionaryKey(
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
    throw new Error(
      `Duplicate local dictionary word or form: ${normalized} (${existing.word}, ${entry.word})`
    )
  }

  index.set(normalized, entry)
}

function flattenBurmeseMeanings(entry: LocalDictionaryEntry): string {
  return entry.meanings.flatMap((meaning) => meaning.burmese).join('၊ ')
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
