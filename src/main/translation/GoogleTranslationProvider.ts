import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import type { TranslationProvider } from './TranslationProvider'

const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'
const REQUEST_TIMEOUT_MS = 8_000

interface GoogleTranslateResponse {
  data?: {
    translations?: Array<{
      translatedText?: unknown
    }>
  }
}

export class GoogleTranslationProvider implements TranslationProvider {
  readonly id = 'google'

  constructor(
    private readonly apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ?? '',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const word = request.word.trim()
    if (!word) {
      throw new Error('Choose a subtitle word to translate.')
    }

    if (!this.apiKey) {
      throw new Error(
        'Google Translation is not configured. Set GOOGLE_TRANSLATE_API_KEY and restart Subtitle Bridge.'
      )
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await this.fetchImpl(
        `${GOOGLE_TRANSLATE_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify({
            q: word,
            source: 'en',
            target: 'my',
            format: 'text'
          }),
          signal: controller.signal
        }
      )

      if (!response.ok) {
        throw new Error(googleFailureMessage(response.status))
      }

      const payload = (await response.json()) as GoogleTranslateResponse
      const translatedText = payload.data?.translations?.[0]?.translatedText
      if (typeof translatedText !== 'string' || !translatedText.trim()) {
        throw new Error('Google Translation returned an empty result. Try another word.')
      }

      return {
        originalWord: word,
        translation: translatedText.trim(),
        provider: this.id
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Google Translation timed out. Try the word again.')
      }

      if (error instanceof Error) {
        throw error
      }

      throw new Error('Google Translation is unavailable right now. Try again shortly.')
    } finally {
      clearTimeout(timeout)
    }
  }
}

function googleFailureMessage(status: number): string {
  if (status === 400) {
    return 'Google Translation rejected this word. Try another subtitle word.'
  }

  if (status === 401 || status === 403) {
    return 'Google Translation rejected the API key or project configuration.'
  }

  if (status === 429) {
    return 'Google Translation quota was reached. Try again later.'
  }

  if (status >= 500) {
    return 'Google Translation is temporarily unavailable. Try again shortly.'
  }

  return 'Google Translation failed. Try the word again.'
}
