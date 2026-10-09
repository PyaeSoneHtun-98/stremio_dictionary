import { afterEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  serviceCreated: vi.fn(),
  fetch: vi.fn(),
}))
vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.7', getPath: () => '/tmp', isPackaged: true, getAppPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) => mock.handlers.set(name, callback),
    removeHandler: (name: string) => mock.handlers.delete(name),
  },
}))
vi.mock('../src/main/stremio/HandoffService', () => ({
  StremioHandoffService: class {
    constructor() {
      mock.serviceCreated()
    }
  },
}))
vi.mock('../src/main/update/UpdateService', () => ({
  UpdateService: class {
    constructor() {
      mock.serviceCreated()
    }
    start = vi.fn()
    dispose = vi.fn()
  },
}))
vi.mock('../src/main/update/GithubUpdateClient', () => ({
  GithubUpdateClient: class {
    constructor() {
      mock.fetch()
    }
  },
}))
import { disposeStremioIpc, registerStremioIpc } from '../src/main/stremio/ipc'
import { disposeUpdateIpc, registerUpdateIpc } from '../src/main/update/ipc'

function invoke(channel: string): unknown {
  const handler = mock.handlers.get(channel)
  if (!handler) throw new Error(`Missing handler ${channel}`)
  return handler({})
}

afterEach(() => {
  disposeStremioIpc()
  disposeUpdateIpc()
  mock.handlers.clear()
  mock.serviceCreated.mockReset()
  mock.fetch.mockReset()
})

describe('macOS platform gating', () => {
  it('reports Stremio handoff unavailable and never creates the Windows helper service', async () => {
    registerStremioIpc('darwin')

    expect(invoke('stremio:get-handoff-status')).toMatchObject({
      state: 'unavailable',
      canEnable: false,
      canDisable: false,
    })
    expect(await invoke('stremio:enable-handoff')).toMatchObject({ ok: false })
    expect(await invoke('stremio:disable-handoff')).toMatchObject({ ok: false })
    expect(mock.serviceCreated).not.toHaveBeenCalled()
  })

  it('keeps the Windows updater idle and offline on macOS', async () => {
    registerUpdateIpc({ isPlaybackActive: () => false, platform: 'darwin' })

    expect(invoke('update:get-state')).toMatchObject({ status: 'idle', currentVersion: '1.0.7' })
    expect(await invoke('update:check')).toMatchObject({ status: 'idle', latestVersion: null })
    expect(await invoke('update:download')).toMatchObject({ ok: false })
    expect(await invoke('update:install')).toMatchObject({ ok: false })
    expect(mock.serviceCreated).not.toHaveBeenCalled()
    expect(mock.fetch).not.toHaveBeenCalled()
  })

  it('still creates the Windows updater on Windows', () => {
    registerUpdateIpc({ isPlaybackActive: () => false, platform: 'win32' })

    expect(mock.serviceCreated).toHaveBeenCalledTimes(1)
    expect(mock.fetch).toHaveBeenCalledTimes(1)
  })
})
