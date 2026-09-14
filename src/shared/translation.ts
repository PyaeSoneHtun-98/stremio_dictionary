export const DICTIONARY_PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'determiner',
  'modal',
  'auxiliary'
] as const

export type DictionaryPartOfSpeech = (typeof DICTIONARY_PARTS_OF_SPEECH)[number]

export interface DictionaryMeaning {
  partOfSpeech: DictionaryPartOfSpeech
  burmese: string[]
}

export interface DictionaryEntry {
  word: string
  pronunciation: string
  forms: string[]
  meanings: DictionaryMeaning[]
}

export interface DictionaryDataset {
  version: 1
  entries: DictionaryEntry[]
}

export interface TranslationRequest {
  word: string
  context?: string
  targetLanguage?: string
}

export interface TranslationResult {
  originalWord: string
  translation: string
  pronunciation?: string
  dictionaryEntry?: DictionaryEntry
  provider: string
  targetLanguage: string
}
