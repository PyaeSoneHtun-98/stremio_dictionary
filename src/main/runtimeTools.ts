import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type RuntimeToolSource = 'environment' | 'bundled' | 'path'

export interface RuntimeToolResolution {
  executable: string
  source: RuntimeToolSource
}

export function resolveMpvExecutable(): RuntimeToolResolution {
  return resolveRuntimeTool('MPV_PATH', 'mpv.exe', ['tools', 'mpv', 'mpv.exe'], 'mpv')
}

export function resolveFfmpegExecutable(): RuntimeToolResolution {
  return resolveRuntimeTool('FFMPEG_PATH', 'ffmpeg.exe', ['tools', 'ffmpeg', 'ffmpeg.exe'], 'ffmpeg')
}

function resolveRuntimeTool(
  environmentVariable: string,
  windowsExecutableName: string,
  bundledPathSegments: string[],
  pathCommand: string
): RuntimeToolResolution {
  const override = process.env[environmentVariable]?.trim()
  if (override) {
    return { executable: override, source: 'environment' }
  }

  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, ...bundledPathSegments)
    if (existsSync(bundled)) {
      return { executable: bundled, source: 'bundled' }
    }
  }

  return {
    executable: process.platform === 'win32' ? windowsExecutableName : pathCommand,
    source: 'path'
  }
}
