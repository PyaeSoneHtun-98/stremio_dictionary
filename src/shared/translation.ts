export interface TranslationRequest {
  word: string
  context?: string
}

export interface TranslationResult {
  originalWord: string
  translation: string
  pronunciation?: string
  provider: string
}
