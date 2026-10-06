import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MissingDictionaryEntryError } from '../src/main/translation/MissingDictionaryEntryError'

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  translate: vi.fn(),
  removeHandler: vi.fn(),
  bridge: null as unknown,
  invoke: vi.fn(),
  networkFetch: vi.fn(),
}))

vi.mock('electron', () => ({
  net: { fetch: mock.networkFetch },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mock.handlers.set(channel, handler),
    removeHandler: (channel: string) => {
      mock.removeHandler(channel)
      mock.handlers.delete(channel)
    },
  },
  ipcRenderer: { invoke: mock.invoke },
  contextBridge: {
    exposeInMainWorld: (_name: string, bridge: unknown) => {
      mock.bridge = bridge
    },
  },
  webUtils: {},
}))
vi.mock('../src/main/translation/TranslationSettingsStore', () => ({
  TranslationSettingsStore: class {},
}))
vi.mock('../src/main/translation/TranslationService', () => ({
  TranslationService: class {
    translate = mock.translate
  },
}))

import { disposeTranslationIpc, registerTranslationIpc } from '../src/main/translation/ipc'
import type { DesktopBridge } from '../src/shared/media'

function handler(channel: string): (...args: unknown[]) => unknown {
  const callback = mock.handlers.get(channel)
  if (!callback) throw new Error(`Missing handler: ${channel}`)
  return callback
}

beforeEach(() => {
  mock.handlers.clear()
  mock.removeHandler.mockClear()
  mock.translate.mockReset()
  mock.networkFetch.mockReset()
  vi.stubEnv(
    'SUBTITLE_BRIDGE_REPORT_ENDPOINT',
    'https://exampleproject.supabase.co/functions/v1/report-dictionary',
  )
})
afterEach(() => {
  disposeTranslationIpc()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('report IPC and preload boundaries', () => {
  it('keeps a structured dictionary miss distinct from a general lookup failure', async () => {
    registerTranslationIpc()
    const lookup = handler('translation:translate-word')
    mock.translate.mockRejectedValueOnce(new MissingDictionaryEntryError())
    expect(await lookup({}, { word: 'unknownword' })).toEqual({
      kind: 'missing',
      message: 'No offline Burmese translation is available for this word yet.',
    })
    mock.translate.mockRejectedValueOnce(new Error('internal failure'))
    await expect(lookup({}, { word: 'knownword' })).rejects.toThrow('internal failure')
  })

  it('registers idempotently, validates at the actual handler, and cleans up both report channels', async () => {
    const nodeFetch = vi.fn().mockRejectedValue(new Error('Node connection reset'))
    vi.stubGlobal('fetch', nodeFetch)
    const fetcher = mock.networkFetch.mockResolvedValue(Response.json({ ok: true }, { status: 202 }))
    registerTranslationIpc()
    registerTranslationIpc()
    expect(handler('translation:report-availability')()).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
    const report = handler('translation:report-dictionary')
    expect(
      await report({}, { term: 'word', category: 'missing', context: 'private subtitle' }),
    ).toEqual({ ok: false, reason: 'invalid' })
    expect(fetcher).not.toHaveBeenCalled()
    expect(await report({}, { term: 'word', category: 'missing' })).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(nodeFetch).not.toHaveBeenCalled()
    expect(fetcher.mock.calls[0]).toEqual([
      'https://exampleproject.supabase.co/functions/v1/report-dictionary',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        signal: expect.any(AbortSignal),
      }),
    ])
    disposeTranslationIpc()
    expect(mock.handlers.size).toBe(0)
    expect(mock.removeHandler).toHaveBeenCalledWith('translation:report-dictionary')
    expect(mock.removeHandler).toHaveBeenCalledWith('translation:report-availability')
  })

  it('aborts an actual IPC report request through Electron networking on disposal', async () => {
    let signal!: AbortSignal
    mock.networkFetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal
          signal.addEventListener('abort', () => reject(new Error('cancelled')))
        }),
    )
    registerTranslationIpc()
    const pending = handler('translation:report-dictionary')({}, { term: 'word', category: 'missing' })
    expect(mock.networkFetch).toHaveBeenCalledTimes(1)
    disposeTranslationIpc()
    expect(signal.aborted).toBe(true)
    expect(await pending).toEqual({ ok: false, reason: 'failed' })
  })

  it('preload exposes only the two named report operations', async () => {
    await import('../src/preload/index')
    const bridge = mock.bridge as DesktopBridge
    const report = { term: 'word', category: 'missing' as const }
    bridge.translation.getReportAvailability()
    bridge.translation.reportDictionaryIssue(report)
    expect(mock.invoke).toHaveBeenCalledWith('translation:report-availability')
    expect(mock.invoke).toHaveBeenCalledWith('translation:report-dictionary', report)
    expect(Object.keys(bridge.translation)).not.toContain('fetch')
  })
})
