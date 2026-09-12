import { spawn, type ChildProcess } from 'node:child_process'
import { basename } from 'node:path'
import { createConnection, type Socket } from 'node:net'
import type { PlaybackSnapshot } from '../../shared/media'
import { normalizeMpvTracks } from '../../shared/media'

const PIPE_PATH = `\\\\.\\pipe\\subtitle-bridge-mpv-${process.pid}`
const CONNECT_RETRIES = 50
const CONNECT_DELAY_MS = 100

interface MpvEvent {
  event?: string
  name?: string
  data?: unknown
  reason?: string
  error?: string
}

export class MpvController {
  private child: ChildProcess | null = null
  private socket: Socket | null = null
  private incomingBuffer = ''
  private paused = false
  private readonly expectedExits = new WeakSet<ChildProcess>()
  private state: PlaybackSnapshot = {
    status: 'idle',
    filePath: null,
    fileName: null,
    currentTime: null,
    duration: null,
    volume: 100,
    speed: 1,
    tracks: [],
    error: null
  }

  constructor(private readonly onState: (state: PlaybackSnapshot) => void) {}

  getState(): PlaybackSnapshot {
    return structuredClone(this.state)
  }

  async load(filePath: string, windowId: string): Promise<void> {
    if (process.platform !== 'win32') {
      this.patchState({
        status: 'unavailable',
        error: 'The playback proof of concept currently supports Windows only.'
      })
      throw new Error('Windows-only playback proof of concept')
    }

    if (!/^\d+$/.test(windowId) || windowId === '0') {
      throw new Error('A valid Windows playback surface is required.')
    }

    try {
      await this.ensureStarted(windowId)
      this.paused = false
      this.patchState({
        status: 'loading',
        filePath,
        fileName: basename(filePath),
        currentTime: 0,
        duration: null,
        speed: 1,
        tracks: [],
        error: null
      })
      this.sendCommand(['set_property', 'speed', 1])
      this.sendCommand(['loadfile', filePath, 'replace'])
      // mpv can transiently leave the replacement file paused while swapping media.
      // Make every newly opened file start playing so the UI and mpv stay in sync.
      this.sendCommand(['set_property', 'pause', false])
    } catch (error) {
      const message = toUserMessage(error)
      this.patchState({ status: 'unavailable', currentTime: null, error: message })
      throw error
    }
  }

  setPaused(paused: boolean): void {
    this.assertControllable()

    if (!paused && this.state.status === 'ended') {
      this.sendCommand(['seek', 0, 'absolute+exact'])
    }

    this.sendCommand(['set_property', 'pause', paused])
  }

  seek(seconds: number): void {
    this.assertControllable()
    const upperBound = this.state.duration ?? Number.MAX_SAFE_INTEGER
    const target = Math.min(Math.max(seconds, 0), upperBound)
    this.sendCommand(['seek', target, 'absolute+exact'])
  }

  setVolume(volume: number): void {
    this.assertConnected()
    const nextVolume = Math.min(Math.max(volume, 0), 100)
    this.sendCommand(['set_property', 'volume', nextVolume])
  }

  setSpeed(speed: number): void {
    this.assertControllable()
    const nextSpeed = Math.min(Math.max(speed, 0.25), 3)
    this.sendCommand(['set_property', 'speed', nextSpeed])
  }

  dispose(): void {
    const socket = this.socket
    this.socket = null

    if (socket && !socket.destroyed) {
      try {
        socket.write(`${JSON.stringify({ command: ['quit'] })}\n`)
      } catch {
        // The IPC pipe can already be closing during application shutdown.
      }
      socket.destroy()
    }

    const child = this.child
    this.child = null

    if (child) {
      this.expectedExits.add(child)
      if (!child.killed) {
        child.kill()
      }
    }
  }

  private async ensureStarted(windowId: string): Promise<void> {
    if (this.child && this.socket && !this.socket.destroyed) {
      return
    }

    const executable = process.env.MPV_PATH?.trim() || 'mpv'
    const child = spawn(
      executable,
      [
        '--no-config',
        '--idle=yes',
        '--keep-open=yes',
        '--sid=no',
        '--no-terminal',
        '--no-osc',
        '--vo=gpu',
        '--gpu-api=d3d11',
        '--gpu-context=d3d11',
        '--hwdec=no',
        ...mpvDiagnosticArguments(),
        `--wid=${windowId}`,
        `--input-ipc-server=${PIPE_PATH}`
      ],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    )

    await new Promise<void>((resolve, reject) => {
      const handleSpawn = (): void => {
        child.off('error', handleError)
        resolve()
      }
      const handleError = (error: Error): void => {
        child.off('spawn', handleSpawn)
        reject(error)
      }

      child.once('spawn', handleSpawn)
      child.once('error', handleError)
    })

    this.child = child

    child.on('exit', (code, signal) => {
      const wasExpected = this.expectedExits.has(child)
      if (this.child !== child) {
        return
      }

      this.child = null
      const socket = this.socket
      this.socket = null
      socket?.destroy()

      if (wasExpected) {
        return
      }

      const detail = code !== null ? ` with exit code ${code}` : signal ? ` after signal ${signal}` : ''
      this.patchState({
        status: 'error',
        currentTime: null,
        error: `mpv exited unexpectedly${detail}. Reopen the video to retry.`
      })
    })

    let socket: Socket
    try {
      socket = await connectToPipe()
    } catch (error) {
      if (this.child === child) {
        this.child = null
      }
      this.expectedExits.add(child)
      if (!child.killed) {
        child.kill()
      }
      throw error
    }

    this.socket = socket
    socket.setEncoding('utf8')
    socket.on('data', (chunk) => this.handleChunk(chunk.toString()))
    socket.on('error', (error) => {
      this.handleSocketFailure(socket, child, `Lost the mpv IPC connection: ${error.message}`)
    })
    socket.on('close', () => {
      this.handleSocketFailure(socket, child, 'The mpv IPC connection closed unexpectedly.')
    })

    this.sendCommand(['observe_property', 1, 'time-pos'])
    this.sendCommand(['observe_property', 2, 'pause'])
    this.sendCommand(['observe_property', 3, 'duration'])
    this.sendCommand(['observe_property', 4, 'track-list'])
    this.sendCommand(['observe_property', 5, 'path'])
    this.sendCommand(['observe_property', 6, 'volume'])
    this.sendCommand(['observe_property', 7, 'speed'])
  }

  private handleSocketFailure(socket: Socket, child: ChildProcess, message: string): void {
    if (this.socket !== socket) {
      return
    }

    this.socket = null
    if (!socket.destroyed) {
      socket.destroy()
    }

    if (this.child === child) {
      this.child = null
      this.expectedExits.add(child)
      if (!child.killed) {
        child.kill()
      }
    }

    this.patchState({ status: 'error', currentTime: null, error: `${message} Reopen the video to retry.` })
  }

  private handleChunk(chunk: string): void {
    this.incomingBuffer += chunk
    const lines = this.incomingBuffer.split('\n')
    this.incomingBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) {
        continue
      }

      try {
        this.handleMessage(JSON.parse(line) as MpvEvent)
      } catch {
        // Ignore malformed messages so a single bad event cannot break playback state updates.
      }
    }
  }

  private handleMessage(message: MpvEvent): void {
    if (message.event === 'start-file') {
      this.patchState({ status: 'loading', error: null })
      return
    }

    if (message.event === 'file-loaded') {
      this.patchState({ status: this.paused ? 'paused' : 'playing', error: null })
      return
    }

    if (message.event === 'end-file') {
      if (message.reason === 'stop') {
        return
      }

      if (message.reason === 'error') {
        const detail = message.error ? ` (${message.error})` : ''
        this.patchState({
          status: 'error',
          currentTime: null,
          error: `This video could not be played${detail}. Try another MKV file.`
        })
        return
      }

      this.patchState({ status: 'ended' })
      return
    }

    if (message.event !== 'property-change' || !message.name) {
      return
    }

    switch (message.name) {
      case 'time-pos':
        this.patchState({ currentTime: finiteNumberOrNull(message.data) })
        break
      case 'duration':
        this.patchState({ duration: finiteNumberOrNull(message.data) })
        break
      case 'pause':
        if (typeof message.data === 'boolean' && this.state.filePath) {
          this.paused = message.data
          this.patchState({ status: message.data ? 'paused' : 'playing' })
        }
        break
      case 'volume': {
        const volume = finiteNumberOrNull(message.data)
        if (volume !== null) {
          this.patchState({ volume: Math.min(Math.max(volume, 0), 100) })
        }
        break
      }
      case 'speed': {
        const speed = finiteNumberOrNull(message.data)
        if (speed !== null) {
          this.patchState({ speed })
        }
        break
      }
      case 'track-list':
        this.patchState({ tracks: normalizeMpvTracks(message.data) })
        break
      default:
        break
    }
  }

  private assertConnected(): void {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('The player is not connected. Reopen the video to retry.')
    }
  }

  private assertControllable(): void {
    this.assertConnected()
    if (!this.state.filePath) {
      throw new Error('Open a video before using playback controls.')
    }
  }

  private sendCommand(command: unknown[]): void {
    this.assertConnected()
    this.socket?.write(`${JSON.stringify({ command })}\n`)
  }

  private patchState(patch: Partial<PlaybackSnapshot>): void {
    this.state = { ...this.state, ...patch }
    this.onState(this.getState())
  }
}

async function connectToPipe(): Promise<Socket> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < CONNECT_RETRIES; attempt += 1) {
    try {
      return await connectOnce()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await delay(CONNECT_DELAY_MS)
    }
  }

  throw lastError ?? new Error('Could not connect to mpv IPC')
}

function connectOnce(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(PIPE_PATH)
    let connected = false

    const handleConnect = (): void => {
      connected = true
      resolve(socket)
    }
    const handleError = (error: Error): void => {
      if (connected) {
        return
      }

      socket.off('connect', handleConnect)
      socket.destroy()
      reject(error)
    }

    socket.once('connect', handleConnect)
    socket.on('error', handleError)
  })
}

function mpvDiagnosticArguments(): string[] {
  const logFile = process.env.MPV_LOG_FILE?.trim()
  if (!logFile) {
    return []
  }

  return [
    `--log-file=${logFile}`,
    '--msg-level=all=warn,vo/gpu=debug,vo/d3d11=debug,w32=debug,cplayer=info'
  ]
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toUserMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return 'mpv was not found. Install mpv and add it to PATH, or set MPV_PATH to mpv.exe.'
  }

  if (error instanceof Error) {
    return `Could not start mpv: ${error.message}`
  }

  return 'Could not start mpv.'
}
