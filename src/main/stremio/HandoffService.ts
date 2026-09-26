import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type StremioHandoffAction = 'enable' | 'disable'

const HANDOFF_MARKER_BEGIN = '/* Subtitle Bridge external player BEGIN */'
const HANDOFF_MARKER_END = '/* Subtitle Bridge external player END */'
const MAX_STATUS_FILE_BYTES = 32 * 1024 * 1024
const MAX_STATUS_STATE_BYTES = 256 * 1024
const MAX_RECORDED_TARGETS = 16

export interface StremioHandoffInspection {
  enabled: boolean
  recordedTargets: number
  patchedTargets: number
}

interface StremioTargetState {
  version: number
  application: string
  paths: unknown
}

export type StremioHandoffRunner = (
  scriptPath: string,
  args: readonly string[]
) => Promise<void>

export class StremioHandoffService {
  constructor(
    private readonly helperRoot: string,
    private readonly executablePath: string,
    private readonly runner: StremioHandoffRunner = runPowerShellHelper,
    private readonly targetStatePath?: string
  ) {}

  inspectStatus(): StremioHandoffInspection {
    const statePath = this.targetStatePath ?? defaultTargetStatePath()
    if (!statePath || !existsSync(statePath)) {
      return { enabled: false, recordedTargets: 0, patchedTargets: 0 }
    }

    const stateStats = statSync(statePath)
    if (!stateStats.isFile() || stateStats.size > MAX_STATUS_STATE_BYTES) {
      throw new Error('The saved Stremio handoff target record is invalid.')
    }

    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<StremioTargetState>
    if (
      parsed.version !== 1 ||
      parsed.application !== 'Subtitle Bridge' ||
      !Array.isArray(parsed.paths) ||
      parsed.paths.length > MAX_RECORDED_TARGETS
    ) {
      throw new Error('The saved Stremio handoff target record has an unsupported format.')
    }

    const paths = parsed.paths
      .map((value) => {
        if (typeof value !== 'string' || !value.trim()) {
          throw new Error('The saved Stremio handoff target record contains an invalid path.')
        }
        return value
      })
      .filter((value, index, values) => values.indexOf(value) === index)

    let patchedTargets = 0
    for (const path of paths) {
      if (!existsSync(path)) {
        continue
      }

      const stats = statSync(path)
      if (!stats.isFile() || stats.size > MAX_STATUS_FILE_BYTES) {
        continue
      }

      const text = readFileSync(path, 'utf8')
      const begin = text.indexOf(HANDOFF_MARKER_BEGIN)
      const end = text.indexOf(HANDOFF_MARKER_END)
      if (begin >= 0 && end > begin) {
        patchedTargets += 1
      }
    }

    return {
      enabled: patchedTargets > 0,
      recordedTargets: paths.length,
      patchedTargets
    }
  }

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


function defaultTargetStatePath(): string | null {
  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (!localAppData) {
    return null
  }

  return join(localAppData, 'Subtitle Bridge', 'stremio-handoff-targets.json')
}
