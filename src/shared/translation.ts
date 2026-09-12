export interface TranslationRequest {
  word: string
  context?: string
  targetLanguage?: string
}

export interface TranslationResult {
  originalWord: string
  translation: string
  pronunciation?: string
  provider: string
  targetLanguage: string
}
