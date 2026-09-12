import type { TranslationResult } from '../../shared/translation'

export interface TranslationCacheKey {
  provider: string
  targetLanguage: string
  word: string
}

export class TranslationCache {
  private readonly entries = new Map<string, TranslationResult>()

  get(key: TranslationCacheKey): TranslationResult | null {
    const result = this.entries.get(serializeKey(key))
    return result ? { ...result } : null
  }

  set(key: TranslationCacheKey, result: TranslationResult): void {
    this.entries.set(serializeKey(key), { ...result })
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}

export function normalizeCacheWord(word: string): string {
  return word.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

function serializeKey(key: TranslationCacheKey): string {
  return `${key.provider}\u0000${key.targetLanguage}\u0000${normalizeCacheWord(key.word)}`
}
