import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type RuntimeToolSource = 'environment' | 'managed' | 'path'

export interface RuntimeToolResolution {
  executable: string
  source: RuntimeToolSource
}

export interface RuntimeToolResolutionOptions {
  environment?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  resourcesPath?: string | null
}

export function resolveMpvExecutable(
  options: RuntimeToolResolutionOptions = {}
): RuntimeToolResolution {
  return resolveRuntimeTool(
    'MPV_PATH',
    'mpv.exe',
    'mpv',
    join('tools', 'mpv', 'mpv.exe'),
    options
  )
}

export function resolveFfmpegExecutable(
  options: RuntimeToolResolutionOptions = {}
): RuntimeToolResolution {
  return resolveRuntimeTool(
    'FFMPEG_PATH',
    'ffmpeg.exe',
    'ffmpeg',
    join('tools', 'ffmpeg', 'ffmpeg.exe'),
    options
  )
}

function resolveRuntimeTool(
  environmentVariable: string,
  windowsExecutableName: string,
  pathCommand: string,
  managedRelativePath: string,
  options: RuntimeToolResolutionOptions
): RuntimeToolResolution {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const resourcesPath = options.resourcesPath ?? getElectronResourcesPath()

  const override = environment[environmentVariable]?.trim()
  if (override) {
    return { executable: override, source: 'environment' }
  }

  if (platform === 'win32' && resourcesPath) {
    const managedExecutable = join(resourcesPath, managedRelativePath)
    if (existsSync(managedExecutable)) {
      return { executable: managedExecutable, source: 'managed' }
    }
  }

  return {
    executable: platform === 'win32' ? windowsExecutableName : pathCommand,
    source: 'path'
  }
}

function getElectronResourcesPath(): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  return typeof resourcesPath === 'string' && resourcesPath.trim() ? resourcesPath : null
}
