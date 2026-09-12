import { BaseWindow, BrowserWindow } from 'electron'
import { join } from 'node:path'

export class PlaybackSurface {
  private hostWindow: BaseWindow | null = null
  private overlayWindow: BrowserWindow | null = null

  async ensure(): Promise<string> {
    if (
      this.hostWindow &&
      !this.hostWindow.isDestroyed() &&
      this.overlayWindow &&
      !this.overlayWindow.isDestroyed()
    ) {
      this.hostWindow.show()
      this.overlayWindow.show()
      this.syncOverlayBounds()
      return getWin32WindowId(this.hostWindow)
    }

    this.dispose()

    const hostWindow = new BaseWindow({
      width: 960,
      height: 600,
      minWidth: 640,
      minHeight: 360,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: 'Subtitle Bridge Video Surface POC'
    })

    const overlayWindow = new BrowserWindow({
      parent: hostWindow,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    this.hostWindow = hostWindow
    this.overlayWindow = overlayWindow

    const syncOverlay = (): void => this.syncOverlayBounds()
    hostWindow.on('move', syncOverlay)
    hostWindow.on('resize', syncOverlay)
    hostWindow.on('maximize', syncOverlay)
    hostWindow.on('unmaximize', syncOverlay)
    hostWindow.on('restore', syncOverlay)
    hostWindow.on('focus', () => {
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.moveTop()
      }
    })

    hostWindow.on('closed', () => {
      if (!overlayWindow.isDestroyed()) {
        overlayWindow.close()
      }
      if (this.hostWindow === hostWindow) {
        this.hostWindow = null
      }
      if (this.overlayWindow === overlayWindow) {
        this.overlayWindow = null
      }
    })

    overlayWindow.on('closed', () => {
      if (this.overlayWindow === overlayWindow) {
        this.overlayWindow = null
      }
    })

    await loadOverlayRenderer(overlayWindow)

    hostWindow.show()
    this.syncOverlayBounds()
    overlayWindow.show()
    overlayWindow.moveTop()

    return getWin32WindowId(hostWindow)
  }

  dispose(): void {
    const overlayWindow = this.overlayWindow
    const hostWindow = this.hostWindow
    this.overlayWindow = null
    this.hostWindow = null

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close()
    }

    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.close()
    }
  }

  private syncOverlayBounds(): void {
    if (
      !this.hostWindow ||
      this.hostWindow.isDestroyed() ||
      !this.overlayWindow ||
      this.overlayWindow.isDestroyed()
    ) {
      return
    }

    this.overlayWindow.setBounds(this.hostWindow.getContentBounds())
    this.overlayWindow.moveTop()
  }
}

async function loadOverlayRenderer(window: BrowserWindow): Promise<void> {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    const url = new URL(rendererUrl)
    url.searchParams.set('mode', 'overlay')
    await window.loadURL(url.toString())
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'), {
    query: { mode: 'overlay' }
  })
}

function getWin32WindowId(window: BaseWindow): string {
  if (process.platform !== 'win32') {
    throw new Error('The playback surface proof of concept currently supports Windows only.')
  }

  const handle = window.getNativeWindowHandle()
  if (handle.byteLength < 4) {
    throw new Error('Electron returned an invalid native window handle.')
  }

  // mpv's win32 --wid contract expects HWND cast to uint32_t.
  return handle.readUInt32LE(0).toString()
}
