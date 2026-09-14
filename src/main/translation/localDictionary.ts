import type { DictionaryDataset, DictionaryEntry } from '../../shared/translation'
import dictionaryData from './data/dictionary.json'

export type LocalDictionaryEntry = DictionaryEntry

export const LOCAL_DICTIONARY_DATASET = dictionaryData as DictionaryDataset
export const LOCAL_DICTIONARY: readonly LocalDictionaryEntry[] = LOCAL_DICTIONARY_DATASET.entries
