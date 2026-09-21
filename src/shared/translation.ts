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

export const PHRASE_TYPES = ['phrasal_verb', 'idiom', 'expression'] as const

export type PhraseType = (typeof PHRASE_TYPES)[number]

export interface PhraseEntry {
  phrase: string
  type: PhraseType
  forms: string[]
  burmese: string[]
}

export interface PhraseDataset {
  version: 1
  entries: PhraseEntry[]
}

export interface PhraseMatch {
  source: string
  startTokenIndex: number
  endTokenIndex: number
}

export interface TranslationRequest {
  word: string
  context?: string
  contextTokens?: string[]
  clickedTokenIndex?: number
  targetLanguage?: string
}

export interface TranslationResult {
  originalWord: string
  translation: string
  pronunciation?: string
  dictionaryEntry?: DictionaryEntry
  phraseEntry?: PhraseEntry
  phraseMatch?: PhraseMatch
  provider: string
  targetLanguage: string
}
