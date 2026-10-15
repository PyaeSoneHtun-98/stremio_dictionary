import { app, ipcMain } from 'electron'
import { resolve } from 'node:path'
import type { StremioHandoffResult, StremioHandoffStatus } from '../../shared/media'
import { diagnosticLog } from '../diagnostics'
import { StremioHandoffService } from './HandoffService'
import {
  developmentStremioStatus,
  packagedStremioStatus,
  unknownPackagedStremioStatus
} from './status'

const STATUS_CHANNEL = 'stremio:get-handoff-status'
const ENABLE_CHANNEL = 'stremio:enable-handoff'
const DISABLE_CHANNEL = 'stremio:disable-handoff'

const WINDOWS_ONLY_MESSAGE =
  'Stremio integration is currently available on Windows only. Paste a stream URL below instead.'

let registered = false

export function registerStremioIpc(platform: NodeJS.Platform = process.platform): void {
  if (registered) {
    return
  }

  registered = true
  // The handoff patch and its PowerShell helpers target Stremio's Windows layout only.
  const supported = platform === 'win32'
  const service =
    supported && app.isPackaged
      ? new StremioHandoffService(resolveHelperRoot(), app.getPath('exe'))
      : null

  ipcMain.handle(STATUS_CHANNEL, (): StremioHandoffStatus => {
    if (!supported) {
      return {
        state: 'unavailable',
        message: WINDOWS_ONLY_MESSAGE,
        canEnable: false,
        canDisable: false
      }
    }

    if (!service) {
      return developmentStremioStatus()
    }

    try {
      return packagedStremioStatus(service.inspectStatus())
    } catch {
      diagnosticLog('stremio.handoffStatusFailed', { reason: 'inspection-failed' })
      return unknownPackagedStremioStatus()
    }
  })

  ipcMain.handle(ENABLE_CHANNEL, async (): Promise<StremioHandoffResult> => {
    diagnosticLog('stremio.handoffEnableRequested')
    if (!supported) {
      return { ok: false, message: WINDOWS_ONLY_MESSAGE }
    }
    if (!service) {
      return {
        ok: false,
        message: 'Install the packaged Subtitle Bridge app before enabling Stremio integration.'
      }
    }

    try {
      await service.enable()
      diagnosticLog('stremio.handoffEnableSucceeded')
      return {
        ok: true,
        message:
          'Play in Subtitle Bridge is enabled. Fully exit and reopen Stremio before using it.'
      }
    } catch {
      diagnosticLog('stremio.handoffEnableFailed', { reason: 'helper-failed' })
      return {
        ok: false,
        message:
          'Could not enable Stremio integration. Make sure a compatible Stremio installation is present and try again.'
      }
    }
  })

  ipcMain.handle(DISABLE_CHANNEL, async (): Promise<StremioHandoffResult> => {
    diagnosticLog('stremio.handoffDisableRequested')
    if (!supported) {
      return { ok: false, message: WINDOWS_ONLY_MESSAGE }
    }
    if (!service) {
      return {
        ok: false,
        message: 'Stremio integration can be changed from the packaged Subtitle Bridge app.'
      }
    }

    try {
      await service.disable()
      diagnosticLog('stremio.handoffDisableSucceeded')
      return {
        ok: true,
        message: 'Play in Subtitle Bridge was disabled. Fully exit and reopen Stremio.'
      }
    } catch {
      diagnosticLog('stremio.handoffDisableFailed', { reason: 'helper-failed' })
      return {
        ok: false,
        message:
          'Could not disable Stremio integration safely. The current Stremio installation may not be compatible.'
      }
    }
  })
}

export function disposeStremioIpc(): void {
  if (!registered) {
    return
  }

  ipcMain.removeHandler(STATUS_CHANNEL)
  ipcMain.removeHandler(ENABLE_CHANNEL)
  ipcMain.removeHandler(DISABLE_CHANNEL)
  registered = false
}

function resolveHelperRoot(): string {
  if (app.isPackaged) {
    return resolve(process.resourcesPath, '..')
  }

  return resolve(app.getAppPath(), 'packaging')
}
