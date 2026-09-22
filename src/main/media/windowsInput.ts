import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const DEFAULT_DOUBLE_CLICK_INTERVAL_MS = 500
export const MAX_DOUBLE_CLICK_INTERVAL_MS = 5_000

const GET_DOUBLE_CLICK_TIME_SCRIPT = [
  "Add-Type -Namespace SubtitleBridge -Name NativeMouse -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern uint GetDoubleClickTime();'",
  '[SubtitleBridge.NativeMouse]::GetDoubleClickTime()'
].join('; ')

let cachedInterval: Promise<number> | null = null

export function normalizeDoubleClickInterval(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DOUBLE_CLICK_INTERVAL_MS
  }

  return Math.min(Math.round(parsed), MAX_DOUBLE_CLICK_INTERVAL_MS)
}

export function getSystemDoubleClickInterval(): Promise<number> {
  if (process.platform !== 'win32') {
    return Promise.resolve(DEFAULT_DOUBLE_CLICK_INTERVAL_MS)
  }

  cachedInterval ??= readWindowsDoubleClickInterval()
  return cachedInterval
}

async function readWindowsDoubleClickInterval(): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', GET_DOUBLE_CLICK_TIME_SCRIPT],
      { windowsHide: true, timeout: 3_000 }
    )
    const numericLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^\d+$/.test(line))

    return normalizeDoubleClickInterval(numericLine)
  } catch {
    return DEFAULT_DOUBLE_CLICK_INTERVAL_MS
  }
}
