import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const MAX_LOG_BYTES = 2 * 1024 * 1024
const MEMORY_SAMPLE_INTERVAL_MS = 10 * 60 * 1000

let logFilePath: string | null = null
let memoryTimer: NodeJS.Timeout | null = null

export function initializeDiagnostics(): string {
  logFilePath = join(app.getPath('userData'), 'diagnostics', 'subtitle-bridge.log')
  mkdirSync(dirname(logFilePath), { recursive: true })
  rotateIfNeeded()

  diagnosticLog('app.ready', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  })

  memoryTimer = setInterval(() => {
    void logMemorySnapshot()
  }, MEMORY_SAMPLE_INTERVAL_MS)
  memoryTimer.unref()
  void logMemorySnapshot()

  return logFilePath
}

export function disposeDiagnostics(): void {
  if (memoryTimer) {
    clearInterval(memoryTimer)
    memoryTimer = null
  }
  diagnosticLog('app.beforeQuit')
}

export function diagnosticLog(event: string, details: Record<string, unknown> = {}): void {
  if (!logFilePath) {
    return
  }

  try {
    rotateIfNeeded()
    const record = {
      timestamp: new Date().toISOString(),
      event,
      details: redactDiagnosticValue(details)
    }
    appendFileSync(logFilePath, `${JSON.stringify(record)}\n`, 'utf8')
  } catch {
    // Diagnostics must never make playback or shutdown fail.
  }
}

export function redactDiagnosticValue(value: unknown, key = ''): unknown {
  if (isSecretKey(key)) {
    return '[REDACTED]'
  }

  if (typeof value === 'string') {
    return redactString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactDiagnosticValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactDiagnosticValue(entryValue, entryKey)
      ])
    )
  }

  return value
}

async function logMemorySnapshot(): Promise<void> {
  try {
    const info = await process.getProcessMemoryInfo()
    diagnosticLog('memory.sample', {
      privateKb: info.private,
      residentSetKb: info.residentSet
    })
  } catch {
    // Memory sampling is best-effort diagnostics only.
  }
}

function rotateIfNeeded(): void {
  if (!logFilePath || !existsSync(logFilePath)) {
    return
  }

  if (statSync(logFilePath).size < MAX_LOG_BYTES) {
    return
  }

  const previous = `${logFilePath}.1`
  try {
    rmSync(previous, { force: true })
    renameSync(logFilePath, previous)
  } catch {
    // Logging must remain non-fatal.
  }
}

function isSecretKey(key: string): boolean {
  return /api[-_]?key|authorization|bearer|secret|token|password/i.test(key)
}

function redactString(value: string): string {
  const home = homedir()
  const withoutHome = home ? value.split(home).join('~') : value

  return withoutHome
    .replace(/([?&](?:key|api_key|apikey)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(GOOGLE_TRANSLATE_API_KEY\s*=\s*)[^\s]+/gi, '$1[REDACTED]')
}
