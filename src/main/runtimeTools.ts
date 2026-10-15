import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type RuntimeToolSource = 'environment' | 'managed' | 'homebrew' | 'path'

// Apps opened from Finder/Dock do not inherit the shell PATH, so look in the standard Homebrew
// prefixes (Apple Silicon first, then Intel) before falling back to a bare command name.
export const MACOS_HOMEBREW_BIN_DIRECTORIES = ['/opt/homebrew/bin', '/usr/local/bin'] as const

export interface RuntimeToolResolution {
  executable: string
  source: RuntimeToolSource
}

export interface RuntimeToolResolutionOptions {
  environment?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  resourcesPath?: string | null
  homebrewDirectories?: readonly string[]
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

export const MACOS_HOMEBREW_LIB_DIRECTORIES = ['/opt/homebrew/lib', '/usr/local/lib'] as const
const LIBMPV_FILE_NAME = 'libmpv.2.dylib'

export interface LibmpvResolution {
  path: string
  source: Extract<RuntimeToolSource, 'environment' | 'homebrew'>
}

export interface LibmpvResolutionOptions {
  environment?: NodeJS.ProcessEnv
  homebrewDirectories?: readonly string[]
}

// macOS plays through libmpv inside the app, loaded at runtime rather than linked or bundled.
export function resolveLibmpv(options: LibmpvResolutionOptions = {}): LibmpvResolution | null {
  const environment = options.environment ?? process.env
  const override = environment.MPV_LIBRARY_PATH?.trim()
  if (override) {
    return { path: override, source: 'environment' }
  }

  for (const directory of options.homebrewDirectories ?? MACOS_HOMEBREW_LIB_DIRECTORIES) {
    const candidate = join(directory, LIBMPV_FILE_NAME)
    if (existsSync(candidate)) {
      return { path: candidate, source: 'homebrew' }
    }
  }

  return null
}

export const MACOS_RUNTIME_INSTALL_COMMAND = 'brew install mpv ffmpeg'

export function missingRuntimeMessage(
  tool: 'mpv' | 'ffmpeg',
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'darwin') {
    const name = tool === 'mpv' ? 'mpv' : 'FFmpeg'
    return `${name} was not found. Install it with Homebrew (${MACOS_RUNTIME_INSTALL_COMMAND}), then reopen the video.`
  }

  return tool === 'mpv'
    ? 'The video player runtime is missing. Reinstall Subtitle Bridge and try again.'
    : 'FFmpeg was not found. Reinstall Subtitle Bridge to restore its managed subtitle runtime, or configure FFMPEG_PATH for development.'
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

  if (platform === 'darwin') {
    for (const directory of options.homebrewDirectories ?? MACOS_HOMEBREW_BIN_DIRECTORIES) {
      const homebrewExecutable = join(directory, pathCommand)
      if (existsSync(homebrewExecutable)) {
        return { executable: homebrewExecutable, source: 'homebrew' }
      }
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
