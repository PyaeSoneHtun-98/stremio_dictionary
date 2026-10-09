import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { diagnosticLog } from '../diagnostics'

export interface MpvRenderStats {
  renderer: string
  frames: number
  width: number
  height: number
  meanLuma: number
}

export interface NativeMpvView {
  createPlayer(
    libraryPath: string,
    viewId: string,
    options: ReadonlyArray<readonly [string, string]>,
    probe: boolean
  ): unknown
  destroyPlayer(player: unknown): void
  getRenderStats(player: unknown): MpvRenderStats
}

const FIRST_STATS_DELAY_MS = 5_000
const STATS_INTERVAL_MS = 60_000
const PROBE_STATS_INTERVAL_MS = 5_000

let nativeModule: NativeMpvView | null = null

function loadNativeMpvView(): NativeMpvView {
  if (!nativeModule) {
    // Loaded with process.dlopen so the bundler leaves the compiled module path alone.
    const module = { exports: {} as NativeMpvView }
    process.dlopen(module, join(app.getAppPath(), 'out', 'native', 'mpv_view.node'))
    nativeModule = module.exports
  }
  return nativeModule
}

export function buildLibmpvOptions(ipcPath: string): Array<[string, string]> {
  return [
    ['config', 'no'],
    ['terminal', 'no'],
    ['idle', 'yes'],
    ['keep-open', 'yes'],
    ['sid', 'no'],
    ['sub-visibility', 'no'],
    ['osc', 'no'],
    ['input-default-bindings', 'no'],
    ['input-vo-keyboard', 'no'],
    ['vo', 'libmpv'],
    ['hwdec', 'no'],
    ['input-ipc-server', ipcPath]
  ]
}

export interface InProcessMpvOptions {
  libraryPath: string | null
  viewId: string
  options: ReadonlyArray<readonly [string, string]>
  probe?: boolean
  loadNative?: () => NativeMpvView
}

/**
 * macOS player: libmpv running inside the app, drawn into the host window by the native view.
 * It mirrors the parts of ChildProcess that MpvController uses (`spawn`/`error`/`exit` events
 * and `kill()`), so the controller's lifecycle handling is shared with the Windows mpv process.
 */
export class InProcessMpv extends EventEmitter {
  killed = false
  private native: NativeMpvView | null = null
  private player: unknown = null
  private statsTimer: NodeJS.Timeout | null = null
  private readonly statsIntervalMs: number

  constructor(options: InProcessMpvOptions) {
    super()
    this.statsIntervalMs = options.probe ? PROBE_STATS_INTERVAL_MS : STATS_INTERVAL_MS
    try {
      if (!options.libraryPath) {
        throw Object.assign(new Error('libmpv was not found.'), { code: 'ENOENT' })
      }
      this.native = (options.loadNative ?? loadNativeMpvView)()
      this.player = this.native.createPlayer(
        options.libraryPath,
        options.viewId,
        options.options,
        options.probe ?? false
      )
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      setImmediate(() => this.emit('error', failure))
      return
    }

    setImmediate(() => this.emit('spawn'))
    this.statsTimer = setTimeout(() => this.logRenderStats(), FIRST_STATS_DELAY_MS)
  }

  renderStats(): MpvRenderStats | null {
    if (!this.native || !this.player) {
      return null
    }
    return this.native.getRenderStats(this.player)
  }

  kill(): boolean {
    if (this.killed) {
      return false
    }

    this.killed = true
    if (this.statsTimer) {
      clearTimeout(this.statsTimer)
      this.statsTimer = null
    }
    const player = this.player
    if (this.native && player) {
      this.logRenderStats()
      this.player = null
      this.native.destroyPlayer(player)
    }
    setImmediate(() => this.emit('exit', 0, null))
    return true
  }

  private logRenderStats(): void {
    const stats = this.renderStats()
    if (stats) {
      diagnosticLog('mpv.renderStats', { ...stats })
    }
    if (!this.killed && this.player) {
      this.statsTimer = setTimeout(() => this.logRenderStats(), this.statsIntervalMs)
    }
  }
}
