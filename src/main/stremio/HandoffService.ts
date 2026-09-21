import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type StremioHandoffAction = 'enable' | 'disable'

export type StremioHandoffRunner = (
  scriptPath: string,
  args: readonly string[]
) => Promise<void>

export class StremioHandoffService {
  constructor(
    private readonly helperRoot: string,
    private readonly executablePath: string,
    private readonly runner: StremioHandoffRunner = runPowerShellHelper
  ) {}

  async enable(): Promise<void> {
    const scriptPath = this.requireHelper('Enable-StremioHandoff.ps1')
    await this.runner(scriptPath, ['-ExecutablePath', this.executablePath])
  }

  async disable(): Promise<void> {
    const scriptPath = this.requireHelper('Disable-StremioHandoff.ps1')
    await this.runner(scriptPath, [])
  }

  private requireHelper(fileName: string): string {
    const scriptPath = join(this.helperRoot, fileName)
    if (!existsSync(scriptPath)) {
      throw new Error('Stremio integration helper is unavailable.')
    }
    return scriptPath
  }
}

function runPowerShellHelper(scriptPath: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      {
        windowsHide: true,
        stdio: 'ignore'
      }
    )

    let settled = false
    const finish = (callback: () => void): void => {
      if (settled) {
        return
      }
      settled = true
      callback()
    }

    child.once('error', () => {
      finish(() => reject(new Error('Could not start the Stremio integration helper.')))
    })

    child.once('close', (code, signal) => {
      finish(() => {
        if (signal || code !== 0) {
          reject(new Error('The Stremio integration helper did not complete successfully.'))
          return
        }
        resolve()
      })
    })
  })
}
