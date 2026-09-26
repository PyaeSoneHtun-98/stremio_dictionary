import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, win32 } from 'node:path'

export type StremioHandoffAction = 'enable' | 'disable'

const HANDOFF_MARKER_BEGIN = '/* Subtitle Bridge external player BEGIN */'
const HANDOFF_MARKER_END = '/* Subtitle Bridge external player END */'
const MAX_STATUS_FILE_BYTES = 32 * 1024 * 1024
const MAX_STATUS_STATE_BYTES = 256 * 1024
const MAX_RECORDED_TARGETS = 16
const STREMIO_EXTERNAL_DEVICES_PATTERN =
  /devices\.groups\.external\s*=\s*\[\s*\]\s*[,;]\s*Object\.keys\(players\)\.forEach/
const STREMIO_PLAYERS_DECLARATION_PATTERN = /\b(?:var|let|const)\s+players\s*=\s*\{/
const STREMIO_PLATFORM_PATH_PATTERN =
  /player\[process\.platform\]\s*&&\s*player\[process\.platform\]\.path\.forEach/
const STREMIO_EXTERNAL_PUSH_PATTERN = /devices\.groups\.external\.push/

export interface StremioHandoffInspection {
  enabled: boolean
  repairNeeded: boolean
  recordedTargets: number
  patchedTargets: number
  verifiedTargets: number
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
      return {
        enabled: false,
        repairNeeded: false,
        recordedTargets: 0,
        patchedTargets: 0,
        verifiedTargets: 0
      }
    }

    const stateStats = statSync(statePath)
    if (!stateStats.isFile() || stateStats.size > MAX_STATUS_STATE_BYTES) {
      throw new Error('The saved Stremio handoff target record is invalid.')
    }

    const stateText = readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(stateText) as Partial<StremioTargetState>
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

        if (
          process.platform === 'win32' &&
          (!win32.isAbsolute(value) ||
            value.startsWith('\\\\') ||
            win32.basename(value).toLocaleLowerCase('en-US') !== 'server.js')
        ) {
          throw new Error('The saved Stremio handoff target record contains an unsafe path.')
        }

        return value
      })
      .filter((value, index, values) => values.indexOf(value) === index)

    let patchedTargets = 0
    let verifiedTargets = 0
    let repairNeeded = false
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
      const hasAnyMarker = begin >= 0 || end >= 0

      if (!hasAnyMarker) {
        continue
      }

      const hasDuplicateBegin =
        begin >= 0 && text.indexOf(HANDOFF_MARKER_BEGIN, begin + HANDOFF_MARKER_BEGIN.length) >= 0
      const hasDuplicateEnd =
        end >= 0 && text.indexOf(HANDOFF_MARKER_END, end + HANDOFF_MARKER_END.length) >= 0

      if (begin < 0 || end <= begin || hasDuplicateBegin || hasDuplicateEnd) {
        throw new Error('A recorded Stremio target contains malformed Subtitle Bridge patch markers.')
      }

      patchedTargets += 1
      const block = text.slice(begin, end + HANDOFF_MARKER_END.length)
      const baseText = text.slice(0, begin) + text.slice(end + HANDOFF_MARKER_END.length)
      const configuredExecutable = readPatchedExecutable(block)
      const currentExecutable =
        configuredExecutable && sameWindowsPath(configuredExecutable, this.executablePath)
      const compatibleLayout = hasCompatibleStremioLayout(baseText)

      if (currentExecutable && compatibleLayout) {
        verifiedTargets += 1
      } else {
        repairNeeded = true
      }
    }

    return {
      enabled: verifiedTargets > 0 && !repairNeeded,
      repairNeeded,
      recordedTargets: paths.length,
      patchedTargets,
      verifiedTargets
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

function hasCompatibleStremioLayout(text: string): boolean {
  return (
    STREMIO_EXTERNAL_DEVICES_PATTERN.test(text) &&
    STREMIO_PLAYERS_DECLARATION_PATTERN.test(text) &&
    STREMIO_PLATFORM_PATH_PATTERN.test(text) &&
    STREMIO_EXTERNAL_PUSH_PATTERN.test(text)
  )
}

function readPatchedExecutable(block: string): string | null {
  const match = block.match(
    /win32\s*:\s*\{\s*path\s*:\s*\[\s*("(?:\\.|[^"\\])*")\s*\]\s*\}/
  )
  if (!match) {
    return null
  }

  try {
    const quotedPath = JSON.parse(match[1]) as unknown
    if (
      typeof quotedPath !== 'string' ||
      quotedPath.length < 3 ||
      !quotedPath.startsWith('"') ||
      !quotedPath.endsWith('"')
    ) {
      return null
    }
    return quotedPath.slice(1, -1)
  } catch {
    return null
  }
}

function sameWindowsPath(left: string, right: string): boolean {
  return (
    win32.normalize(left).toLocaleLowerCase('en-US') ===
    win32.normalize(right).toLocaleLowerCase('en-US')
  )
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
