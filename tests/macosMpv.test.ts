import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getAppPath: () => '/app' } }))
vi.mock('../src/main/diagnostics', () => ({ diagnosticLog: vi.fn() }))
import { diagnosticLog } from '../src/main/diagnostics'
import { buildLibmpvOptions, InProcessMpv, type NativeMpvView } from '../src/main/media/macosMpv'

const stats = {
  renderer: 'Apple M1',
  frames: 42,
  width: 1920,
  height: 1080,
  meanLuma: 120,
  glError: 0,
  framebuffer: 1
}

function fakeNative(overrides: Partial<NativeMpvView> = {}): NativeMpvView {
  return {
    createPlayer: vi.fn(() => ({ handle: true })),
    destroyPlayer: vi.fn(),
    getRenderStats: vi.fn(() => stats),
    ...overrides
  }
}

function nextEvent(target: InProcessMpv, ...names: string[]): Promise<[string, unknown[]]> {
  return new Promise((resolve) => {
    for (const name of names) target.once(name, (...args: unknown[]) => resolve([name, args]))
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(diagnosticLog).mockReset()
})

describe('macOS in-process mpv', () => {
  it('renders through libmpv and keeps control on the shared JSON IPC socket', () => {
    const options = new Map(buildLibmpvOptions('/tmp/sb-mpv-x/mpv-1.sock'))

    expect(options.get('vo')).toBe('libmpv')
    expect(options.get('input-ipc-server')).toBe('/tmp/sb-mpv-x/mpv-1.sock')
    expect(options.get('config')).toBe('no')
    expect(options.get('sub-visibility')).toBe('no')
    expect(options.get('input-default-bindings')).toBe('no')
    expect(options.has('wid')).toBe(false)
  })

  it('creates the native player and emits spawn like a child process', async () => {
    const native = fakeNative()
    const player = new InProcessMpv({
      libraryPath: '/opt/homebrew/lib/libmpv.2.dylib',
      viewId: '105553116266496',
      options: [['vo', 'libmpv']],
      probe: true,
      loadNative: () => native
    })

    expect(await nextEvent(player, 'spawn', 'error')).toEqual(['spawn', []])
    expect(native.createPlayer).toHaveBeenCalledWith(
      '/opt/homebrew/lib/libmpv.2.dylib',
      '105553116266496',
      [['vo', 'libmpv']],
      true
    )
    expect(player.renderStats()).toEqual(stats)
    player.kill()
  })

  it('reports a missing Homebrew libmpv as ENOENT without loading the native module', async () => {
    const loadNative = vi.fn(fakeNative)
    const player = new InProcessMpv({ libraryPath: null, viewId: '1', options: [], loadNative })

    const [name, [error]] = await nextEvent(player, 'spawn', 'error')
    expect(name).toBe('error')
    expect((error as NodeJS.ErrnoException).code).toBe('ENOENT')
    expect(loadNative).not.toHaveBeenCalled()
  })

  it('turns native creation failures into an error event', async () => {
    const native = fakeNative({
      createPlayer: vi.fn(() => {
        throw Object.assign(new Error('mpv could not start'), { code: 'EMPV' })
      })
    })
    const player = new InProcessMpv({
      libraryPath: '/lib/libmpv.2.dylib',
      viewId: '1',
      options: [],
      loadNative: () => native
    })

    const [name, [error]] = await nextEvent(player, 'spawn', 'error')
    expect(name).toBe('error')
    expect((error as NodeJS.ErrnoException).code).toBe('EMPV')
  })

  it('destroys the native player once, logs final render stats and emits exit', async () => {
    const native = fakeNative()
    const player = new InProcessMpv({
      libraryPath: '/lib/libmpv.2.dylib',
      viewId: '1',
      options: [],
      loadNative: () => native
    })
    await nextEvent(player, 'spawn')

    const exit = nextEvent(player, 'exit')
    expect(player.kill()).toBe(true)
    expect(player.kill()).toBe(false)
    expect(await exit).toEqual(['exit', [0, null]])
    expect(player.killed).toBe(true)
    expect(native.destroyPlayer).toHaveBeenCalledTimes(1)
    expect(diagnosticLog).toHaveBeenCalledWith('mpv.renderStats', stats)
    expect(player.renderStats()).toBeNull()
  })

  it('logs render stats shortly after start and stops after kill', async () => {
    vi.useFakeTimers()
    const native = fakeNative()
    const player = new InProcessMpv({
      libraryPath: '/lib/libmpv.2.dylib',
      viewId: '1',
      options: [],
      loadNative: () => native
    })

    vi.advanceTimersByTime(5_000)
    expect(diagnosticLog).toHaveBeenCalledTimes(1)
    player.kill()
    vi.advanceTimersByTime(120_000)
    expect(diagnosticLog).toHaveBeenCalledTimes(2)
  })
})
