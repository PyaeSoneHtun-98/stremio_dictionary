import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { stat } from 'node:fs/promises'
import type {
  LoadExternalSubtitleResult,
  OpenVideoResult,
  PlaybackSnapshot,
  SubtitlePreferencesSnapshot,
  SubtitlePreferencesUpdate
} from '../../shared/media'
import { parseMediaTarget } from './launchTarget'
import { MpvController } from './MpvController'
import { PlaybackSurface } from './PlaybackSurface'
import { SerialTaskQueue } from './SerialTaskQueue'
import { SubtitlePreferencesStore } from './SubtitlePreferencesStore'
import { SubtitleSession } from './SubtitleSession'
import { ExternalSubtitleLoadCoordinator } from './ExternalSubtitleLoadCoordinator'
import { ExternalSubtitleExtractor } from '../subtitles/ExternalSubtitleExtractor'
import {
  describeExternalSubtitle,
  type ExternalSubtitleDescriptor,
  validateExternalSubtitleSize
} from '../subtitles/externalSubtitle'

const MEDIA_STATE_CHANNEL = 'media:state'
const OPEN_VIDEO_CHANNEL = 'media:open-video'
const OPEN_VIDEO_PATH_CHANNEL = 'media:open-video-path'
const LOAD_EXTERNAL_SUBTITLE_PATH_CHANNEL = 'media:load-external-subtitle-path'
const GET_STATE_CHANNEL = 'media:get-state'
const SET_PAUSED_CHANNEL = 'media:set-paused'
const SEEK_CHANNEL = 'media:seek'
const SET_VOLUME_CHANNEL = 'media:set-volume'
const SET_SPEED_CHANNEL = 'media:set-speed'
const SET_SUBTITLE_DELAY_CHANNEL = 'media:set-subtitle-delay'
const SELECT_SUBTITLE_TRACK_CHANNEL = 'media:select-subtitle-track'
const GET_SUBTITLE_PREFERENCES_CHANNEL = 'media:get-subtitle-preferences'
const UPDATE_SUBTITLE_PREFERENCES_CHANNEL = 'media:update-subtitle-preferences'
const TOGGLE_FULLSCREEN_CHANNEL = 'media:toggle-fullscreen'

// mpv's own --log-file output can contain the complete media URL, including private
// Stremio query parameters. Subtitle Bridge diagnostics must remain structured and
// redacted, so raw mpv file logging is intentionally unsupported.
delete process.env.MPV_LOG_FILE

const subtitleSession = new SubtitleSession(broadcastState)
const controller = new MpvController((state) => subtitleSession.handleBaseState(state))
const externalSubtitleExtractor = new ExternalSubtitleExtractor()
const externalSubtitleLoadCoordinator = new ExternalSubtitleLoadCoordinator({
  getState: () => controller.getState(),
  validate: validateExternalSubtitleFile,
  extract: (filePath, format) => externalSubtitleExtractor.extract(filePath, format),
  setExternal: (state, fileName, format, cues) => {
    subtitleSession.setExternal(state, fileName, format, cues)
  }
})
const subtitlePreferencesStore = new SubtitlePreferencesStore()
const playbackSurface = new PlaybackSurface()
const openMediaQueue = new SerialTaskQueue()
let registered = false

export function registerMediaIpc(): void {
  if (registered) {
    return
  }

  registered = true

  ipcMain.handle(OPEN_VIDEO_CHANNEL, async (event): Promise<OpenVideoResult> => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: 'Open MKV video',
      properties: ['openFile'],
      filters: [{ name: 'Matroska video', extensions: ['mkv'] }]
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true }
    }

    return openMediaTarget(result.filePaths[0])
  })

  ipcMain.handle(OPEN_VIDEO_PATH_CHANNEL, async (_event, filePath: unknown): Promise<OpenVideoResult> => {
    if (typeof filePath !== 'string') {
      return { cancelled: false, error: 'The dropped file path was invalid.' }
    }

    return openMediaTarget(filePath)
  })

  ipcMain.handle(
    LOAD_EXTERNAL_SUBTITLE_PATH_CHANNEL,
    async (_event, filePath: unknown): Promise<LoadExternalSubtitleResult> => {
      if (typeof filePath !== 'string') {
        return { loaded: false, error: 'The dropped subtitle path was invalid.' }
      }

      return externalSubtitleLoadCoordinator.load(filePath)
    }
  )

  ipcMain.handle(GET_STATE_CHANNEL, () => subtitleSession.getState(controller.getState()))
  ipcMain.handle(SET_PAUSED_CHANNEL, (_event, paused: unknown) => {
    if (typeof paused !== 'boolean') {
      throw new Error('Invalid play/pause value.')
    }
    controller.setPaused(paused)
  })
  ipcMain.handle(SEEK_CHANNEL, (_event, seconds: unknown) => {
    controller.seek(requireFiniteNumber(seconds, 'seek position'))
  })
  ipcMain.handle(SET_VOLUME_CHANNEL, (_event, volume: unknown) => {
    controller.setVolume(requireFiniteNumber(volume, 'volume'))
  })
  ipcMain.handle(SET_SPEED_CHANNEL, (_event, speed: unknown) => {
    controller.setSpeed(requireFiniteNumber(speed, 'playback speed'))
  })
  ipcMain.handle(SET_SUBTITLE_DELAY_CHANNEL, (_event, seconds: unknown) => {
    controller.setSubtitleDelay(requireFiniteNumber(seconds, 'subtitle delay'))
  })
  ipcMain.handle(SELECT_SUBTITLE_TRACK_CHANNEL, async (_event, trackId: unknown) => {
    const value = requireFiniteNumber(trackId, 'subtitle track')
    if (!Number.isSafeInteger(value)) {
      throw new Error('Invalid subtitle track.')
    }

    if (subtitleSession.isExternalTrack(value)) {
      const state = controller.getState()
      if (state.status !== 'paused') {
        throw new Error('Pause playback before changing subtitle tracks.')
      }
      subtitleSession.activateExternal(state)
      return
    }

    await controller.selectSubtitleTrack(value)
    subtitleSession.deactivateExternal(controller.getState())
  })
  ipcMain.handle(
    GET_SUBTITLE_PREFERENCES_CHANNEL,
    (): Promise<SubtitlePreferencesSnapshot> => subtitlePreferencesStore.getSnapshot()
  )
  ipcMain.handle(
    UPDATE_SUBTITLE_PREFERENCES_CHANNEL,
    (_event, update: unknown): Promise<SubtitlePreferencesSnapshot> => {
      if (!update || typeof update !== 'object' || Array.isArray(update)) {
        throw new Error('Invalid subtitle preference update.')
      }
      return subtitlePreferencesStore.update(update as SubtitlePreferencesUpdate)
    }
  )
  ipcMain.handle(TOGGLE_FULLSCREEN_CHANNEL, () => playbackSurface.toggleFullscreen())
}

export function openMediaTarget(rawTarget: string): Promise<OpenVideoResult> {
  return openMediaQueue.run(() => openMediaTargetNow(rawTarget))
}

async function openMediaTargetNow(rawTarget: string): Promise<OpenVideoResult> {
  try {
    // Defense in depth: never allow an environment change after module initialization to
    // re-enable mpv's unsafe raw log-file output for a later media request.
    delete process.env.MPV_LOG_FILE

    const mediaTarget = parseMediaTarget(rawTarget)
    if (mediaTarget.kind === 'file') {
      await validateMkvFile(mediaTarget.target)
    }

    const windowId = await playbackSurface.ensure()
    externalSubtitleLoadCoordinator.invalidate()
    externalSubtitleExtractor.cancel()
    subtitleSession.clear(controller.getState())
    await controller.load(mediaTarget.target, windowId, mediaTarget.displayName)
    // Loading mpv can take long enough for the regular app window to finish showing
    // and steal foreground activation. Re-activate the player after mpv is ready so
    // Stremio and command-line handoffs land directly on the video.
    playbackSurface.focus()
    return { cancelled: false }
  } catch (error) {
    return {
      cancelled: false,
      error: error instanceof Error ? error.message : 'Could not open the video.'
    }
  }
}

export function disposeMediaIpc(): void {
  externalSubtitleLoadCoordinator.invalidate()
  externalSubtitleExtractor.dispose()
  controller.dispose()
  playbackSurface.dispose()

  if (!registered) {
    return
  }

  ipcMain.removeHandler(OPEN_VIDEO_CHANNEL)
  ipcMain.removeHandler(OPEN_VIDEO_PATH_CHANNEL)
  ipcMain.removeHandler(LOAD_EXTERNAL_SUBTITLE_PATH_CHANNEL)
  ipcMain.removeHandler(GET_STATE_CHANNEL)
  ipcMain.removeHandler(SET_PAUSED_CHANNEL)
  ipcMain.removeHandler(SEEK_CHANNEL)
  ipcMain.removeHandler(SET_VOLUME_CHANNEL)
  ipcMain.removeHandler(SET_SPEED_CHANNEL)
  ipcMain.removeHandler(SET_SUBTITLE_DELAY_CHANNEL)
  ipcMain.removeHandler(SELECT_SUBTITLE_TRACK_CHANNEL)
  ipcMain.removeHandler(GET_SUBTITLE_PREFERENCES_CHANNEL)
  ipcMain.removeHandler(UPDATE_SUBTITLE_PREFERENCES_CHANNEL)
  ipcMain.removeHandler(TOGGLE_FULLSCREEN_CHANNEL)
  registered = false
}

async function validateMkvFile(filePath: string): Promise<void> {
  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(filePath)
  } catch {
    throw new Error('That video file is no longer available. Choose it again and retry.')
  }

  if (!fileStats.isFile()) {
    throw new Error('The selected path is not a video file.')
  }
}

async function validateExternalSubtitleFile(filePath: string): Promise<ExternalSubtitleDescriptor> {
  const descriptor = describeExternalSubtitle(filePath)
  let fileStats: Awaited<ReturnType<typeof stat>>

  try {
    fileStats = await stat(filePath)
  } catch {
    throw new Error('That subtitle file is no longer available. Drop it again and retry.')
  }

  if (!fileStats.isFile()) {
    throw new Error('The dropped path is not a subtitle file.')
  }

  validateExternalSubtitleSize(fileStats.size)
  return descriptor
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}.`)
  }

  return value
}

function broadcastState(state: PlaybackSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(MEDIA_STATE_CHANNEL, state)
    }
  }
}
