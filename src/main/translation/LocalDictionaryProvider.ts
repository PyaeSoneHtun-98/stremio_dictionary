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

    const lookupWord = normalizeLookupWord(originalWord)
    const entry = this.index.get(lookupWord)
    if (!entry) {
      throw new Error(`No offline Burmese translation is available for “${originalWord}” yet.`)
    }

    return {
      originalWord,
      translation: entry.translation,
      ...(entry.pronunciation ? { pronunciation: entry.pronunciation } : {}),
      provider: this.id
    }
  }
}

function buildDictionaryIndex(
  dictionary: Readonly<Record<string, LocalDictionaryEntry>>
): ReadonlyMap<string, LocalDictionaryEntry> {
  const index = new Map<string, LocalDictionaryEntry>()

  for (const [headword, entry] of Object.entries(dictionary)) {
    addDictionaryKey(index, headword, entry)
    for (const alias of entry.aliases ?? []) {
      addDictionaryKey(index, alias, entry)
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
    throw new Error(`Duplicate local dictionary word: ${normalized}`)
  }

  index.set(normalized, entry)
}

export function normalizeLookupWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}
