import type { TranslationRequest, TranslationResult } from '../../shared/translation'

export interface TranslationProvider {
  readonly id: string
  translate(request: TranslationRequest): Promise<TranslationResult>
}
