import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { diagnosticLog, disposeDiagnostics, initializeDiagnostics } from './diagnostics'
import { disposeMediaIpc, registerMediaIpc } from './media/ipc'
import { disposeTranslationIpc, registerTranslationIpc } from './translation/ipc'

// On some Windows x64 systems, Chromium's accelerated transparent windows render their
// transparent region as black. The subtitle overlay is a transparent BrowserWindow above mpv's
// independently accelerated D3D11 child window, so software-composite the Electron UI only.
app.disableHardwareAcceleration()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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
