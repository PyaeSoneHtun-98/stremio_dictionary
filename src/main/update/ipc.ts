import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type SpawnOptions } from 'node:child_process'
import { join } from 'node:path'
import type { UpdateActionResult, UpdateSnapshot } from '../../shared/update'
import { GithubUpdateClient } from './GithubUpdateClient'
import {
  createInstallerEnvironment,
  currentInstallDirectory,
  installerWorkingDirectory,
  type WindowsDirectoryResolver,
} from './installLaunch'
import { UpdateService } from './UpdateService'

const UPDATE_STATE_CHANNEL = 'update:state'
const GET_UPDATE_STATE_CHANNEL = 'update:get-state'
const CHECK_UPDATE_CHANNEL = 'update:check'
const DOWNLOAD_UPDATE_CHANNEL = 'update:download'
const INSTALL_UPDATE_CHANNEL = 'update:install'
const UNSUPPORTED_PLATFORM_ERROR =
  'In-app updates are available on Windows only. Download new macOS builds from GitHub Releases.'

let service: UpdateService | null = null
let registered = false

export interface RegisterUpdateIpcOptions {
  isPlaybackActive: () => boolean
  platform?: NodeJS.Platform
}

export function registerUpdateIpc(options: RegisterUpdateIpcOptions): void {
  if (registered) {
    return
  }

  registered = true
  if ((options.platform ?? process.platform) !== 'win32') {
    registerUnsupportedPlatformHandlers()
    return
  }

  service = new UpdateService({
    currentVersion: app.getVersion(),
    updatesRoot: join(app.getPath('userData'), 'updates'),
    client: new GithubUpdateClient(),
    isPlaybackActive: options.isPlaybackActive,
    launchInstaller: (installerPath) => launchInstaller(installerPath, app.getPath('exe')),
    quitApp: () => app.quit(),
    onState: broadcastState
  })

  ipcMain.handle(GET_UPDATE_STATE_CHANNEL, (): UpdateSnapshot => requireService().getState())
  ipcMain.handle(CHECK_UPDATE_CHANNEL, (): Promise<UpdateSnapshot> => requireService().checkForUpdates())
  ipcMain.handle(
    DOWNLOAD_UPDATE_CHANNEL,
    (): Promise<UpdateActionResult> => requireService().downloadUpdate()
  )
  ipcMain.handle(
    INSTALL_UPDATE_CHANNEL,
    (): Promise<UpdateActionResult> => requireService().installUpdate()
  )

  service.start()
}

// The updater downloads and launches the Windows setup executable. Other platforms stay idle,
// which keeps the renderer's update strip hidden, and never contact the release API.
function registerUnsupportedPlatformHandlers(): void {
  const snapshot: UpdateSnapshot = {
    status: 'idle',
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseName: null,
    releaseNotes: null,
    publishedAt: null,
    downloadPercent: null,
    error: null,
    checkedAt: null,
  }
  const unsupported = async (): Promise<UpdateActionResult> => ({
    ok: false,
    error: UNSUPPORTED_PLATFORM_ERROR,
  })

  ipcMain.handle(GET_UPDATE_STATE_CHANNEL, (): UpdateSnapshot => ({ ...snapshot }))
  ipcMain.handle(CHECK_UPDATE_CHANNEL, async (): Promise<UpdateSnapshot> => ({ ...snapshot }))
  ipcMain.handle(DOWNLOAD_UPDATE_CHANNEL, unsupported)
  ipcMain.handle(INSTALL_UPDATE_CHANNEL, unsupported)
}

export function disposeUpdateIpc(): void {
  service?.dispose()
  service = null

  if (!registered) {
    return
  }

  ipcMain.removeHandler(GET_UPDATE_STATE_CHANNEL)
  ipcMain.removeHandler(CHECK_UPDATE_CHANNEL)
  ipcMain.removeHandler(DOWNLOAD_UPDATE_CHANNEL)
  ipcMain.removeHandler(INSTALL_UPDATE_CHANNEL)
  registered = false
}

export function createInstallerSpawnOptions(
  installerPath: string,
  executablePath: string,
  resolveDirectory?: WindowsDirectoryResolver,
): SpawnOptions {
  const installDirectory = currentInstallDirectory(executablePath)
  const workingDirectory = installerWorkingDirectory(
    installerPath,
    installDirectory,
    resolveDirectory,
  )

  return {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    cwd: workingDirectory,
    env: createInstallerEnvironment(installDirectory, executablePath),
  }
}

async function launchInstaller(
  installerPath: string,
  executablePath: string,
): Promise<void> {
  const child = spawn(installerPath, [], createInstallerSpawnOptions(installerPath, executablePath))

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })

  child.unref()
}

function requireService(): UpdateService {
  if (!service) {
    throw new Error('Update service is unavailable.')
  }

  return service
}

function broadcastState(state: UpdateSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATE_STATE_CHANNEL, state)
    }
  }
}
