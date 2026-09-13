import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'node:path'
import { diagnosticLog, disposeDiagnostics, initializeDiagnostics } from './diagnostics'
import { disposeMediaIpc, openMediaTarget, registerMediaIpc } from './media/ipc'
import { findLaunchTargetArgument } from './media/launchTarget'
import { disposeTranslationIpc, registerTranslationIpc } from './translation/ipc'

// On some Windows x64 systems, Chromium's accelerated transparent windows render their
// transparent region as black. The subtitle overlay is a transparent BrowserWindow above mpv's
// independently accelerated D3D11 child window, so software-composite the Electron UI only.
app.disableHardwareAcceleration()

const hasSingleInstanceLock = app.requestSingleInstanceLock()
let mainWindow: BrowserWindow | null = null

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    focusMainWindow()
    void handleLaunchArguments(commandLine)
  })

  app.whenReady().then(() => {
    const logPath = initializeDiagnostics()
    diagnosticLog('diagnostics.initialized', { logPath: logPath.replace(app.getPath('home'), '~') })

    app.on('render-process-gone', (_event, _contents, details) => {
      diagnosticLog('renderer.gone', { reason: details.reason, exitCode: details.exitCode })
    })
    app.on('child-process-gone', (_event, details) => {
      diagnosticLog('childProcess.gone', {
        type: details.type,
        reason: details.reason,
        exitCode: details.exitCode,
        serviceName: details.serviceName
      })
    })

    registerMediaIpc()
    registerTranslationIpc()
    createWindow()
    void handleLaunchArguments(process.argv)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        focusMainWindow()
      }
    })
  })

  app.on('before-quit', () => {
    disposeTranslationIpc()
    disposeMediaIpc()
    disposeDiagnostics()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })
  window.once('ready-to-show', () => window.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void window.loadFile(join(__dirname, '../renderer/index.html'))
}

async function handleLaunchArguments(argv: readonly string[]): Promise<void> {
  const target = findLaunchTargetArgument(argv)
  if (!target) {
    return
  }

  diagnosticLog('media.externalLaunchRequested', { source: target.toLowerCase().startsWith('vlc://') ? 'stremio-vlc' : 'direct' })
  const result = await openMediaTarget(target)
  if (result.error) {
    diagnosticLog('media.externalLaunchRejected', { reason: result.error })
    dialog.showErrorBox('Could not open media', result.error)
  }
}

function focusMainWindow(): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) {
    return
  }

  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}
