import { describe, expect, it, vi } from 'vitest'
import { GoogleTranslationProvider } from '../src/main/translation/GoogleTranslationProvider'

describe('GoogleTranslationProvider', () => {
  it('requires an API key before making a network request', async () => {
    const fetchMock = vi.fn()
    const provider = new GoogleTranslationProvider('', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'emperor' })).rejects.toThrow(
      'Google Translation is not configured'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends only the selected word to Google and targets Burmese', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'emperor',
        source: 'en',
        target: 'my',
        format: 'text'
      })

      return new Response(
        JSON.stringify({
          data: {
            translations: [{ translatedText: 'ဧကရာဇ်' }]
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    const provider = new GoogleTranslationProvider('test-key', fetchMock as typeof fetch)

    await expect(
      provider.translate({ word: 'emperor', context: 'You will be emperor.' })
    ).resolves.toEqual({
      originalWord: 'emperor',
      translation: 'ဧကရာဇ်',
      provider: 'google'
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toContain('translation.googleapis.com/language/translate/v2')
    expect(String(requestUrl)).toContain('key=test-key')
  })

  it('reports quota failures without exposing provider response details', async () => {
    const fetchMock = vi.fn(async () => new Response('quota details', { status: 429 }))
    const provider = new GoogleTranslationProvider('test-key', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'run' })).rejects.toThrow(
      'Google Translation quota was reached'
    )
  })

  it('rejects an empty translation response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { translations: [{ translatedText: '' }] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const provider = new GoogleTranslationProvider('test-key', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'hello' })).rejects.toThrow('returned an empty result')
  })
})
