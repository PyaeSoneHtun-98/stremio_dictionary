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
}

export class MpvController {
  private child: ChildProcess | null = null
  private socket: Socket | null = null
  private incomingBuffer = ''
  private state: PlaybackSnapshot = {
    status: 'idle',
    filePath: null,
    fileName: null,
    currentTime: null,
    duration: null,
    tracks: [],
    error: null
  }

  constructor(private readonly onState: (state: PlaybackSnapshot) => void) {}

  getState(): PlaybackSnapshot {
    return structuredClone(this.state)
  }

  async load(filePath: string): Promise<void> {
    if (process.platform !== 'win32') {
      this.patchState({
        status: 'unavailable',
        error: 'The playback proof of concept currently supports Windows only.'
      })
      throw new Error('Windows-only playback proof of concept')
    }

    try {
      await this.ensureStarted()
      this.patchState({
        status: 'loading',
        filePath,
        fileName: basename(filePath),
        currentTime: 0,
        duration: null,
        tracks: [],
        error: null
      })
      this.sendCommand(['loadfile', filePath, 'replace'])
    } catch (error) {
      const message = toUserMessage(error)
      this.patchState({ status: 'unavailable', error: message })
      throw error
    }
  }

  dispose(): void {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.sendCommand(['quit'])
      } catch {
        // The IPC pipe can already be closing during application shutdown.
      }
      this.socket.destroy()
    }

    this.socket = null

    if (this.child && !this.child.killed) {
      this.child.kill()
    }

    this.child = null
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && this.socket && !this.socket.destroyed) {
      return
    }

    const executable = process.env.MPV_PATH?.trim() || 'mpv'
    const child = spawn(
      executable,
      [
        '--idle=yes',
        '--force-window=yes',
        '--keep-open=yes',
        '--sid=no',
        '--no-terminal',
        '--title=Subtitle Bridge Playback POC',
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

    child.on('exit', () => {
      this.child = null
      this.socket?.destroy()
      this.socket = null
    })

    this.child = child

    try {
      this.socket = await connectToPipe()
    } catch (error) {
      if (!child.killed) {
        child.kill()
      }
      this.child = null
      throw error
    }

    this.socket.setEncoding('utf8')
    this.socket.on('data', (chunk) => this.handleChunk(chunk.toString()))
    this.socket.on('close', () => {
      this.socket = null
    })

    this.sendCommand(['observe_property', 1, 'time-pos'])
    this.sendCommand(['observe_property', 2, 'pause'])
    this.sendCommand(['observe_property', 3, 'duration'])
    this.sendCommand(['observe_property', 4, 'track-list'])
    this.sendCommand(['observe_property', 5, 'path'])
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
      this.patchState({ status: 'playing', error: null })
      return
    }

    if (message.event === 'end-file') {
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
          this.patchState({ status: message.data ? 'paused' : 'playing' })
        }
        break
      case 'track-list':
        this.patchState({ tracks: normalizeMpvTracks(message.data) })
        break
      default:
        break
    }
  }

  private sendCommand(command: unknown[]): void {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('mpv IPC is not connected')
    }

    this.socket.write(`${JSON.stringify({ command })}\n`)
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

    socket.once('connect', () => {
      socket.removeAllListeners('error')
      resolve(socket)
    })

    socket.once('error', (error) => {
      socket.destroy()
      reject(error)
    })
  })
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
