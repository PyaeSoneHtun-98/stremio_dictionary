import { spawn, type ChildProcess } from 'node:child_process'
import { basename } from 'node:path'
import { createConnection, type Socket } from 'node:net'
import type { MediaTrack, PlaybackSnapshot, SubtitleCue } from '../../shared/media'
import { createEmptySubtitleModel, normalizeMpvTracks } from '../../shared/media'
import { diagnosticLog } from '../diagnostics'
import { resolveMpvExecutable } from '../runtimeTools'
import { SubtitleExtractor } from '../subtitles/SubtitleExtractor'
import { findActiveCue } from '../subtitles/normalize'

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
  private readonly subtitleExtractor = new SubtitleExtractor()
  private subtitleCues: SubtitleCue[] = []
  private subtitleExtractionKey: string | null = null
  private subtitleExtractionVersion = 0
  private selectedSubtitleTrackId: number | null = null
  private state: PlaybackSnapshot = {
    status: 'idle',
    filePath: null,
    fileName: null,
    currentTime: null,
    duration: null,
    volume: 100,
    speed: 1,
    tracks: [],
    subtitle: createEmptySubtitleModel(),
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

    diagnosticLog('media.loadRequested', { fileName: basename(filePath) })

    try {
      await this.ensureStarted(windowId)
      this.resetSubtitleExtraction()
      this.selectedSubtitleTrackId = null
      this.paused = false
      this.patchState({
        status: 'loading',
        filePath,
        fileName: basename(filePath),
        currentTime: 0,
        duration: null,
        speed: 1,
        tracks: [],
        subtitle: createEmptySubtitleModel(),
        error: null
      })
      this.sendCommand(['set_property', 'speed', 1])
      this.sendCommand(['loadfile', filePath, 'replace'])
      this.sendCommand(['set_property', 'pause', false])
    } catch (error) {
      const message = toUserMessage(error)
      diagnosticLog('media.loadFailed', { fileName: basename(filePath), message })
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

  async selectSubtitleTrack(trackId: number): Promise<void> {
    this.assertControllable()

    if (this.state.status !== 'paused') {
      throw new Error('Pause playback before changing subtitle tracks.')
    }

    const track = this.state.tracks.find(
      (candidate) => candidate.type === 'subtitle' && candidate.id === trackId
    )

    if (!track) {
      throw new Error('That subtitle track is no longer available.')
    }

    if (track.subtitleKind !== 'text' || track.ffIndex === null) {
      throw new Error('Only embedded text subtitle tracks can be selected in the MVP.')
    }

    if (
      this.selectedSubtitleTrackId === track.id &&
      this.state.subtitle.trackId === track.id &&
      ['extracting', 'ready'].includes(this.state.subtitle.status)
    ) {
      return
    }

    this.selectedSubtitleTrackId = track.id
    this.resetSubtitleExtraction()
    await this.refreshSubtitleModel(this.state.tracks)
  }

  dispose(): void {
    this.subtitleExtractor.dispose()
    this.subtitleExtractionVersion += 1

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

    const runtime = resolveMpvExecutable()
    diagnosticLog('mpv.start', { source: runtime.source })
    const child = spawn(
      runtime.executable,
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
        diagnosticLog('mpv.spawned', { source: runtime.source })
        resolve()
      }
      const handleError = (error: Error): void => {
        child.off('spawn', handleSpawn)
        diagnosticLog('mpv.spawnFailed', { source: runtime.source, message: error.message })
        reject(error)
      }

      child.once('spawn', handleSpawn)
      child.once('error', handleError)
    })

    this.child = child

    child.on('exit', (code, signal) => {
      const wasExpected = this.expectedExits.has(child)
      diagnosticLog('mpv.exit', { expected: wasExpected, code, signal })
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
      this.failPlayback(`mpv exited unexpectedly${detail}. Reopen the video to retry.`)
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

    diagnosticLog('mpv.ipcFailure', { message })
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

    this.failPlayback(`${message} Reopen the video to retry.`)
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
      diagnosticLog('media.fileLoaded', { fileName: this.state.fileName })
      this.patchState({ status: this.paused ? 'paused' : 'playing', error: null })
      return
    }

    if (message.event === 'end-file') {
      if (message.reason === 'stop') {
        return
      }

      if (message.reason === 'error') {
        const detail = message.error ? ` (${message.error})` : ''
        this.failPlayback(`This video could not be played${detail}. Try another MKV file.`)
        return
      }

      this.patchState({ status: 'ended' })
      return
    }

    if (message.event !== 'property-change' || !message.name) {
      return
    }

    switch (message.name) {
      case 'time-pos': {
        const currentTime = finiteNumberOrNull(message.data)
        const applyAssEffectHeuristics = isAssSubtitleCodec(this.state.subtitle.trackCodec)
        const activeCue =
          this.state.subtitle.status === 'ready'
            ? findActiveCue(
                this.subtitleCues,
                currentTime,
                this.state.subtitle.trackLanguage ?? this.state.subtitle.trackTitle,
                applyAssEffectHeuristics
              )
            : null
        this.patchState({
          currentTime,
          subtitle: { ...this.state.subtitle, activeCue }
        })
        break
      }
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
      case 'track-list': {
        const tracks = normalizeMpvTracks(message.data)
        this.patchState({ tracks })
        void this.refreshSubtitleModel(tracks)
        break
      }
      default:
        break
    }
  }

  private async refreshSubtitleModel(tracks: MediaTrack[]): Promise<void> {
    const filePath = this.state.filePath
    if (!filePath) {
      return
    }

    const subtitleTracks = tracks.filter((track) => track.type === 'subtitle')
    const textTracks = subtitleTracks.filter(
      (track) => track.subtitleKind === 'text' && track.ffIndex !== null
    )

    const selectedTrack =
      this.selectedSubtitleTrackId === null
        ? chooseSubtitleTrack(textTracks)
        : textTracks.find((track) => track.id === this.selectedSubtitleTrackId) ?? null

    if (!selectedTrack || selectedTrack.ffIndex === null) {
      this.resetSubtitleExtraction()
      this.selectedSubtitleTrackId = null

      if (subtitleTracks.length === 0) {
        this.patchState({
          subtitle: {
            ...createEmptySubtitleModel(),
            status: 'missing',
            error:
              'This MKV has no embedded subtitle tracks. Try another MKV with embedded SRT, ASS, or SSA subtitles.'
          }
        })
        return
      }

      const imageOnly = subtitleTracks.every((track) => track.subtitleKind === 'image')
      this.patchState({
        subtitle: {
          ...createEmptySubtitleModel(),
          status: 'unsupported',
          error: imageOnly
            ? 'This MKV only contains image-based subtitles such as PGS/VobSub. Image subtitles are not supported in the MVP.'
            : 'No supported embedded text subtitle track was found. Use an MKV with SRT, ASS, or SSA subtitles.'
        }
      })
      return
    }

    this.selectedSubtitleTrackId = selectedTrack.id
    const extractionKey = `${filePath}\u0000${selectedTrack.id}\u0000${selectedTrack.ffIndex}`
    if (this.subtitleExtractionKey === extractionKey) {
      return
    }

    this.subtitleExtractionKey = extractionKey
    this.subtitleCues = []
    const version = ++this.subtitleExtractionVersion
    this.patchState({
      subtitle: {
        status: 'extracting',
        trackId: selectedTrack.id,
        trackLanguage: selectedTrack.language,
        trackTitle: selectedTrack.title,
        trackCodec: selectedTrack.codec,
        cueCount: 0,
        activeCue: null,
        error: null
      }
    })

    try {
      const cues = await this.subtitleExtractor.extract(filePath, selectedTrack.ffIndex)
      if (version !== this.subtitleExtractionVersion || this.subtitleExtractionKey !== extractionKey) {
        return
      }

      this.subtitleCues = cues
      diagnosticLog('subtitle.ready', {
        codec: selectedTrack.codec,
        language: selectedTrack.language,
        cueCount: cues.length
      })
      this.patchState({
        subtitle: {
          status: 'ready',
          trackId: selectedTrack.id,
          trackLanguage: selectedTrack.language,
          trackTitle: selectedTrack.title,
          trackCodec: selectedTrack.codec,
          cueCount: cues.length,
          activeCue: findActiveCue(
            cues,
            this.state.currentTime,
            selectedTrack.language ?? selectedTrack.title,
            isAssSubtitleCodec(selectedTrack.codec)
          ),
          error: null
        }
      })
    } catch (error) {
      if (version !== this.subtitleExtractionVersion || this.subtitleExtractionKey !== extractionKey) {
        return
      }

      const message = error instanceof Error ? error.message : 'Could not extract this subtitle track.'
      diagnosticLog('subtitle.failed', { codec: selectedTrack.codec, language: selectedTrack.language, message })
      this.subtitleCues = []
      this.patchState({
        subtitle: {
          status: 'error',
          trackId: selectedTrack.id,
          trackLanguage: selectedTrack.language,
          trackTitle: selectedTrack.title,
          trackCodec: selectedTrack.codec,
          cueCount: 0,
          activeCue: null,
          error: message
        }
      })
    }
  }

  private failPlayback(message: string): void {
    diagnosticLog('playback.failed', { message })
    const subtitle = { ...this.state.subtitle, activeCue: null }
    const subtitleWasActive = subtitle.status === 'extracting' || subtitle.status === 'ready'

    this.resetSubtitleExtraction()

    if (subtitleWasActive) {
      subtitle.status = 'error'
      subtitle.cueCount = 0
      subtitle.error = 'Subtitle processing stopped because playback failed.'
    }

    this.patchState({
      status: 'error',
      currentTime: null,
      subtitle,
      error: message
    })
  }

  private resetSubtitleExtraction(): void {
    this.subtitleExtractor.cancel()
    this.subtitleExtractionVersion += 1
    this.subtitleExtractionKey = null
    this.subtitleCues = []
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

function chooseSubtitleTrack(tracks: MediaTrack[]): MediaTrack | null {
  if (tracks.length === 0) {
    return null
  }

  return (
    tracks.find((track) => {
      const language = track.language?.toLowerCase()
      return language === 'eng' || language === 'en' || language?.startsWith('en-')
    }) ??
    tracks.find((track) => track.selected) ??
    tracks[0]
  )
}

function isAssSubtitleCodec(codec: string | null | undefined): boolean {
  const normalized = codec?.trim().toLocaleLowerCase('en-US')
  return normalized === 'ass' || normalized === 'ssa'
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
    return 'mpv was not found. Install mpv and add it to PATH, set MPV_PATH to mpv.exe, or use a package that bundles mpv.exe.'
  }

  if (error instanceof Error) {
    return `Could not start mpv: ${error.message}`
  }

  return 'Could not start mpv.'
}
