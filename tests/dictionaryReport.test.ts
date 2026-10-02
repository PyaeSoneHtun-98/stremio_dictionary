import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DictionaryReportClient,
  validateReportEndpoint,
} from '../src/main/translation/DictionaryReportClient'
import { normalizeDictionaryReport } from '../src/shared/dictionaryReport'
import { appMeta } from '../src/shared/appMeta'

const endpoint = 'https://exampleproject.supabase.co/functions/v1/report-dictionary'
const report = { term: 'CHOSEN', category: 'incorrect' }
const accepted = () => Response.json({ ok: true }, { status: 202 })

afterEach(() => vi.useRealTimers())

describe('dictionary report HTTPS client', () => {
  it('accepts only the configured HTTPS Supabase function without credentials or redirects', () => {
    expect(validateReportEndpoint(endpoint)).toBe(endpoint)
    for (const value of [
      'http://exampleproject.supabase.co/functions/v1/report-dictionary',
      'https://exampleproject.supabase.co.evil.test/functions/v1/report-dictionary',
      `${endpoint}?token=secret`,
      `${endpoint}#fragment`,
      'https://user:secret@exampleproject.supabase.co/functions/v1/report-dictionary',
      'https://exampleproject.supabase.co:8443/functions/v1/report-dictionary',
      'https://exampleproject.supabase.co/rest/v1/dictionary_reports',
    ])
      expect(validateReportEndpoint(value)).toBeNull()
  })

  it('rejects extra fields, paths, context, invalid categories, and oversized terms', () => {
    for (const value of [
      null,
      [],
      { ...report, context: 'private subtitle' },
      { ...report, term: 'https://private.example/stream' },
      { ...report, term: 'C:\\Videos\\private.mkv' },
      { ...report, term: 'word\ncontext' },
      { ...report, term: 'one two three four five six' },
      { ...report, term: 'a'.repeat(121) },
      { ...report, category: 'subtitle-error' },
    ])
      expect(normalizeDictionaryReport(value)).toBeNull()
    expect(normalizeDictionaryReport({ term: ' Give  Up ', category: 'incorrect' })).toEqual({
      term: 'give up',
      category: 'incorrect',
    })
  })

  it('sends only explicit reports, deriving trusted versions and omitting secrets/cookies', async () => {
    const fetcher = vi.fn().mockResolvedValue(accepted())
    const client = new DictionaryReportClient(endpoint, fetcher)
    expect(client.available).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
    await expect(client.submit(report)).resolves.toEqual({ ok: true })
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe(endpoint)
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' })
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
    expect(JSON.parse(options.body)).toEqual({
      term: 'chosen',
      category: 'incorrect',
      requestId: expect.any(String),
      targetLanguage: 'my',
      appVersion: appMeta.version,
      dictionaryVersion: '1.0',
      phraseDictionaryVersion: '1.0.0',
    })
    client.dispose()
  })

  it('shares concurrent submissions and remembers success for the current session', async () => {
    let resolve!: (response: Response) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    const client = new DictionaryReportClient(endpoint, fetcher)
    const first = client.submit(report)
    const second = client.submit(report)
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolve(accepted())
    expect(await first).toEqual({ ok: true })
    expect(await second).toEqual({ ok: true })
    await client.submit(report)
    expect(fetcher).toHaveBeenCalledTimes(1)
    client.dispose()
  })

  it('retries failures with the same receipt ID and handles rate limits safely', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('private provider text'))
      .mockResolvedValueOnce(Response.json({}, { status: 429 }))
      .mockResolvedValueOnce(accepted())
    const client = new DictionaryReportClient(endpoint, fetcher)
    expect(await client.submit(report)).toEqual({ ok: false, reason: 'failed' })
    expect(await client.submit(report)).toEqual({ ok: false, reason: 'rate-limited' })
    expect(await client.submit(report)).toEqual({ ok: true })
    const ids = fetcher.mock.calls.map((call) => JSON.parse(call[1].body).requestId)
    expect(new Set(ids).size).toBe(1)
    client.dispose()
  })

  it('does not accept malformed or excessive successful responses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: false }))
      .mockResolvedValueOnce(new Response('x'.repeat(1025), { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = new DictionaryReportClient(endpoint, fetcher)
    for (let i = 0; i < 3; i++)
      expect(await client.submit(report)).toEqual({ ok: false, reason: 'failed' })
    client.dispose()
  })

  it('bounds pending requests and aborts them on application shutdown', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const client = new DictionaryReportClient(endpoint, fetcher)
    const first = client.submit(report)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await first).toEqual({ ok: false, reason: 'failed' })
    const retry = client.submit(report)
    client.dispose()
    expect(await retry).toEqual({ ok: false, reason: 'failed' })
    expect(await client.submit(report)).toEqual({ ok: false, reason: 'unavailable' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fails closed when configuration is absent or renderer input is invalid', async () => {
    const fetcher = vi.fn()
    const client = new DictionaryReportClient('', fetcher)
    expect(client.available).toBe(false)
    expect(await client.submit(report)).toEqual({ ok: false, reason: 'unavailable' })
    expect(await client.submit({ ...report, appVersion: 'untrusted' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
