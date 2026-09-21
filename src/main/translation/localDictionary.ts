import type { DictionaryDataset, DictionaryEntry } from '../../shared/translation'
import { CORE_LOCAL_DICTIONARY } from './coreDictionary'
import dictionaryData from './data/dictionary.json'

export type LocalDictionaryEntry = DictionaryEntry

export const LOCAL_DICTIONARY_DATASET = dictionaryData as DictionaryDataset
export const PRODUCTION_LOCAL_DICTIONARY: readonly LocalDictionaryEntry[] =
  LOCAL_DICTIONARY_DATASET.entries

// The frozen 30,000-entry corpus remains untouched. These 16 structured core entries preserve
// useful starter coverage that is intentionally outside the frozen dataset.
export const LOCAL_DICTIONARY: readonly LocalDictionaryEntry[] = [
  ...PRODUCTION_LOCAL_DICTIONARY,
  ...CORE_LOCAL_DICTIONARY
]
