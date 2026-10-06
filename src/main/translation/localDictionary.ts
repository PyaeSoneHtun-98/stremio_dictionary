import type { DictionaryDataset, DictionaryEntry } from '../../shared/translation'
import { CORE_LOCAL_DICTIONARY } from './coreDictionary'
import dictionaryData from './data/dictionary.json'
import extensionData from './data/dictionary-extension.json'
import correctionData from './data/dictionary-extension-corrections.json'

export type LocalDictionaryEntry = DictionaryEntry

export const LOCAL_DICTIONARY_DATASET = dictionaryData as DictionaryDataset
export const PRODUCTION_LOCAL_DICTIONARY: readonly LocalDictionaryEntry[] =
  LOCAL_DICTIONARY_DATASET.entries

// Vendor the upstream extension unchanged; reviewed app corrections live in a separate asset.
export const LOCAL_DICTIONARY_EXTENSION_DATASET = extensionData as DictionaryDataset
const corrections = correctionData as DictionaryDataset
const correctionByWord = new Map(corrections.entries.map((entry) => [entry.word, entry]))
const extensionWords = new Set(
  LOCAL_DICTIONARY_EXTENSION_DATASET.entries.map((entry) => entry.word),
)
if (
  correctionByWord.size !== corrections.entries.length ||
  corrections.entries.some((entry) => !extensionWords.has(entry.word))
) {
  throw new Error('Dictionary extension corrections must have unique existing targets.')
}
export const LOCAL_DICTIONARY_EXTENSION: readonly LocalDictionaryEntry[] =
  LOCAL_DICTIONARY_EXTENSION_DATASET.entries.map(
    (entry) => correctionByWord.get(entry.word) ?? entry,
  )

// love and wait are explicitly reconciled in the reviewed corrections, including waited.
// Any future overlap must receive an explicit review instead of silently dropping a core entry.
const reconciledCoreWords = new Set(['love', 'wait'])
for (const entry of CORE_LOCAL_DICTIONARY) {
  if (extensionWords.has(entry.word) && !reconciledCoreWords.has(entry.word)) {
    throw new Error('Dictionary extension has an unreviewed core overlap.')
  }
}
export const RETAINED_CORE_DICTIONARY = CORE_LOCAL_DICTIONARY.filter(
  (entry) => !extensionWords.has(entry.word),
)

// Keep the frozen 30k corpus byte-for-byte intact and compose all layers once at module load.
export const LOCAL_DICTIONARY: readonly LocalDictionaryEntry[] = [
  ...PRODUCTION_LOCAL_DICTIONARY,
  ...LOCAL_DICTIONARY_EXTENSION,
  ...RETAINED_CORE_DICTIONARY,
]
