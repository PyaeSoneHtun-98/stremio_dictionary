import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { UpdateActionResult, UpdateSnapshot } from '../../shared/update'
import { GithubUpdateClient } from './GithubUpdateClient'
import { createInstallerEnvironment, currentInstallDirectory } from './installLaunch'
import { UpdateService } from './UpdateService'

const UPDATE_STATE_CHANNEL = 'update:state'
const GET_UPDATE_STATE_CHANNEL = 'update:get-state'
const CHECK_UPDATE_CHANNEL = 'update:check'
const DOWNLOAD_UPDATE_CHANNEL = 'update:download'
const INSTALL_UPDATE_CHANNEL = 'update:install'

let service: UpdateService | null = null
let registered = false

export interface RegisterUpdateIpcOptions {
  isPlaybackActive: () => boolean
}

export function registerUpdateIpc(options: RegisterUpdateIpcOptions): void {
  if (registered) {
    return
  }

  registered = true
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

async function launchInstaller(
  installerPath: string,
  executablePath: string
): Promise<void> {
  const installDirectory = currentInstallDirectory(executablePath)
  const child = spawn(installerPath, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    env: createInstallerEnvironment(installDirectory, executablePath)
  })

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
