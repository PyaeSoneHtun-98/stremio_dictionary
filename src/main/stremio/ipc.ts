import { app, ipcMain } from 'electron'
import { resolve } from 'node:path'
import type { StremioHandoffResult } from '../../shared/media'
import { diagnosticLog } from '../diagnostics'
import { StremioHandoffService } from './HandoffService'

const ENABLE_CHANNEL = 'stremio:enable-handoff'
const DISABLE_CHANNEL = 'stremio:disable-handoff'

let registered = false

export function registerStremioIpc(): void {
  if (registered) {
    return
  }

  registered = true
  const service = new StremioHandoffService(resolveHelperRoot(), app.getPath('exe'))

  ipcMain.handle(ENABLE_CHANNEL, async (): Promise<StremioHandoffResult> => {
    diagnosticLog('stremio.handoffEnableRequested')
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
