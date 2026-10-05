import { randomUUID } from 'node:crypto'
import { appMeta } from '../../shared/appMeta'
import {
  normalizeDictionaryReport,
  REPORT_DICTIONARY_VERSION,
  REPORT_PHRASE_DICTIONARY_VERSION,
  type DictionaryReportOutcome,
} from '../../shared/dictionaryReport'

interface Submission {
  requestId: string
  completed: boolean
  pending?: Promise<DictionaryReportOutcome>
}

export function validateReportEndpoint(value: string): string | null {
  try {
    const url = new URL(value)
    const approvedRoute =
      (/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) &&
        url.pathname === '/functions/v1/report-dictionary') ||
      (url.hostname === 'subtitle-report-service.vercel.app' &&
        url.pathname === '/api/report-dictionary')
    if (
      url.protocol !== 'https:' ||
      !approvedRoute ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    return url.href
  } catch {
    return null
  }
}

export class DictionaryReportClient {
  private readonly endpoint: string | null
  private readonly submissions = new Map<string, Submission>()
  private readonly controllers = new Set<AbortController>()
  private disposed = false

  constructor(
    endpoint: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.endpoint = validateReportEndpoint(endpoint)
  }

  get available(): boolean {
    return this.endpoint !== null && !this.disposed
  }

  async submit(value: unknown): Promise<DictionaryReportOutcome> {
    const report = normalizeDictionaryReport(value)
    if (!report) return { ok: false, reason: 'invalid' }
    if (!this.available) return { ok: false, reason: 'unavailable' }
    const key = JSON.stringify([report.category, report.term])
    let submission = this.submissions.get(key)
    if (submission?.completed) return { ok: true }
    if (submission?.pending) return submission.pending
    if (!submission) {
      // Bound session state and network submissions even for a compromised renderer.
      if (this.submissions.size >= 100) return { ok: false, reason: 'rate-limited' }
      submission = { requestId: randomUUID(), completed: false }
      this.submissions.set(key, submission)
    }
    const current = submission
    const controller = new AbortController()
    this.controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 10_000)
    current.pending = this.send(
      {
        ...report,
        requestId: current.requestId,
        targetLanguage: 'my',
        appVersion: appMeta.version,
        dictionaryVersion: REPORT_DICTIONARY_VERSION,
        phraseDictionaryVersion: REPORT_PHRASE_DICTIONARY_VERSION,
      },
      controller.signal,
    )
      .then((outcome) => {
        current.completed = outcome.ok
        return outcome
      })
      .finally(() => {
        clearTimeout(timeout)
        this.controllers.delete(controller)
        current.pending = undefined
      })
    return current.pending
  }

  dispose(): void {
    this.disposed = true
    for (const controller of this.controllers) controller.abort()
    this.controllers.clear()
    this.submissions.clear()
  }

  private async send(payload: object, signal: AbortSignal): Promise<DictionaryReportOutcome> {
    try {
      const response = await this.fetcher(this.endpoint as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'error',
        credentials: 'omit',
        signal,
      })
      if (response.status === 429) {
        await response.body?.cancel()
        return { ok: false, reason: 'rate-limited' }
      }
      if (response.status !== 200 && response.status !== 202) {
        await response.body?.cancel()
        return { ok: false, reason: 'failed' }
      }
      const reader = response.body?.getReader()
      if (!reader) return { ok: false, reason: 'failed' }
      let text = ''
      let bytes = 0
      const decoder = new TextDecoder()
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > 1024) return { ok: false, reason: 'failed' }
          text += decoder.decode(chunk.value, { stream: true })
        }
        text += decoder.decode()
        return JSON.parse(text)?.ok === true ? { ok: true } : { ok: false, reason: 'failed' }
      } finally {
        await reader.cancel()
      }
    } catch {
      // Never expose or log network/provider bodies, submitted words, or credentials.
      return { ok: false, reason: 'failed' }
    }
  }
}
