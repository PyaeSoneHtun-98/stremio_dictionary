import type { TranslationResult } from '../../shared/translation'

export interface TranslationCacheKey {
  provider: string
  targetLanguage: string
  word: string
}

export class TranslationCache {
  private readonly entries = new Map<string, TranslationResult>()
  private generationValue = 0

  get(key: TranslationCacheKey): TranslationResult | null {
    const result = this.entries.get(serializeTranslationCacheKey(key))
    return result ? { ...result } : null
  }

  setIfCurrent(
    key: TranslationCacheKey,
    result: TranslationResult,
    generation: number
  ): boolean {
    if (generation !== this.generationValue) {
      return false
    }

    this.entries.set(serializeTranslationCacheKey(key), { ...result })
    return true
  }

  clear(): void {
    this.entries.clear()
    this.generationValue += 1
  }

  get size(): number {
    return this.entries.size
  }

  get generation(): number {
    return this.generationValue
  }
}

export function normalizeCacheWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

export function serializeTranslationCacheKey(key: TranslationCacheKey): string {
  return `${key.provider}\u0000${key.targetLanguage}\u0000${normalizeCacheWord(key.word)}`
}
