import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import type { PlaybackSnapshot } from '../../shared/media'
import { MpvController } from './MpvController'
import { PlaybackSurface } from './PlaybackSurface'

const MEDIA_STATE_CHANNEL = 'media:state'
const OPEN_VIDEO_CHANNEL = 'media:open-video'
const GET_STATE_CHANNEL = 'media:get-state'

const controller = new MpvController(broadcastState)
const playbackSurface = new PlaybackSurface()
let registered = false

export function registerMediaIpc(): void {
  if (registered) {
    return
  }

  registered = true

  ipcMain.handle(OPEN_VIDEO_CHANNEL, async (event) => {
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

    try {
      const windowId = await playbackSurface.ensure()
      await controller.load(result.filePaths[0], windowId)
      return { cancelled: false }
    } catch (error) {
      return {
        cancelled: false,
        error: error instanceof Error ? error.message : 'Could not open the video.'
      }
    }
  })

  ipcMain.handle(GET_STATE_CHANNEL, () => controller.getState())
}

export function disposeMediaIpc(): void {
  controller.dispose()
  playbackSurface.dispose()

  if (!registered) {
    return
  }

  ipcMain.removeHandler(OPEN_VIDEO_CHANNEL)
  ipcMain.removeHandler(GET_STATE_CHANNEL)
  registered = false
}

function broadcastState(state: PlaybackSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(MEDIA_STATE_CHANNEL, state)
    }
  }
}
