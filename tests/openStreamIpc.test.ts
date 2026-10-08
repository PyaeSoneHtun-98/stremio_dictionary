import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesktopBridge } from '../src/shared/media'

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  load: vi.fn(), ensure: vi.fn(), focus: vi.fn(), clear: vi.fn(),
  invalidate: vi.fn(), cancel: vi.fn(), stat: vi.fn(), invoke: vi.fn(),
  bridge: null as unknown,
}))
vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] }, dialog: {},
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) => mock.handlers.set(name, callback),
    removeHandler: (name: string) => mock.handlers.delete(name),
  },
  ipcRenderer: { invoke: mock.invoke },
  contextBridge: { exposeInMainWorld: (_name: string, bridge: unknown) => { mock.bridge = bridge } },
  webUtils: {},
}))
vi.mock('node:fs/promises', () => ({ stat: mock.stat }))
vi.mock('../src/main/media/MpvController', () => ({ MpvController: class {
  load = mock.load
  getState = () => ({ error: null })
  dispose = vi.fn()
} }))
vi.mock('../src/main/media/PlaybackSurface', () => ({ PlaybackSurface: class {
  ensure = mock.ensure
  focus = mock.focus
  dispose = vi.fn()
} }))
vi.mock('../src/main/media/SubtitleSession', () => ({ SubtitleSession: class { clear = mock.clear } }))
vi.mock('../src/main/media/SubtitlePreferencesStore', () => ({ SubtitlePreferencesStore: class {} }))
vi.mock('../src/main/media/ExternalSubtitleLoadCoordinator', () => ({ ExternalSubtitleLoadCoordinator: class { invalidate = mock.invalidate } }))
vi.mock('../src/main/subtitles/ExternalSubtitleExtractor', () => ({ ExternalSubtitleExtractor: class { cancel = mock.cancel; dispose = vi.fn() } }))
import { disposeMediaIpc, registerMediaIpc } from '../src/main/media/ipc'

beforeEach(() => {
  mock.handlers.clear()
  mock.load.mockReset().mockResolvedValue(undefined)
  mock.ensure.mockReset().mockResolvedValue('123')
  for (const f of [mock.focus, mock.clear, mock.invalidate, mock.cancel, mock.stat, mock.invoke]) f.mockReset()
  registerMediaIpc()
})
afterEach(disposeMediaIpc)
function open(value: unknown): Promise<unknown> {
  const handler = mock.handlers.get('media:open-stream')
  if (!handler) throw Error('Missing stream handler')
  return handler({}, value) as Promise<unknown>
}

describe('stream IPC and preload', () => {
  it('rejects non-HTTP input at the real handler without touching playback', async () => {
    for (const value of [null, {}, 'file:///D:/movie.mp4', 'D:\\movie.mp4', 'vlc://http://localhost/a', 'ftp://media.example/a', 'https://', 'https://media.example/a\nprivate']) {
      expect(await open(value)).toEqual({ cancelled: false, error: 'Enter a valid HTTP or HTTPS stream URL.' })
    }
    expect(mock.load).not.toHaveBeenCalled()
    expect(mock.ensure).not.toHaveBeenCalled()
    expect(mock.clear).not.toHaveBeenCalled()
  })

  it.each([
    ['http://127.0.0.1:11470/stream/example?token=synthetic', 'Stremio stream'],
    ['https://media.example/video.mp4?token=synthetic', 'Network stream (media.example)'],
  ])('uses the shared surface/controller/session path for %s', async (url, label) => {
    expect(await open(`  ${url}  `)).toEqual({ cancelled: false })
    expect(mock.load).toHaveBeenCalledExactlyOnceWith(url, '123', label)
    expect(mock.stat).not.toHaveBeenCalled()
    expect(mock.clear).toHaveBeenCalledOnce()
    expect(mock.invalidate).toHaveBeenCalledOnce()
    expect(mock.cancel).toHaveBeenCalledOnce()
    expect(mock.focus).toHaveBeenCalledOnce()
  })

  it('rejects duplicate in-flight requests and restores the guard after a failure', async () => {
    let reject!: (error: Error) => void
    mock.load.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    const first = open('https://media.example/video')
    await vi.waitFor(() => expect(mock.load).toHaveBeenCalledOnce())
    expect(await open('https://other.example/video')).toEqual({ cancelled: false, error: 'A stream is already opening. Please wait.' })
    reject(new Error('private https://media.example/video?token=secret'))
    expect(await first).toEqual({ cancelled: false, error: 'Could not open the stream. Check the URL and try again.' })
    expect(await open('https://other.example/video')).toEqual({ cancelled: false })
    expect(mock.load).toHaveBeenCalledTimes(2)
  })

  it('cleans up registration and exposes only the narrow preload operation', async () => {
    registerMediaIpc()
    expect(mock.handlers.has('media:open-stream')).toBe(true)
    await import('../src/preload/index')
    const bridge = mock.bridge as DesktopBridge
    bridge.media.openStream('https://media.example/video')
    expect(mock.invoke).toHaveBeenCalledExactlyOnceWith('media:open-stream', 'https://media.example/video')
    disposeMediaIpc()
    expect(mock.handlers.has('media:open-stream')).toBe(false)
    registerMediaIpc()
    expect(mock.handlers.has('media:open-stream')).toBe(true)
  })
})
