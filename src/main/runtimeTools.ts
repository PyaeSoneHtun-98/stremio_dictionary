export type RuntimeToolSource = 'environment' | 'path'

export interface RuntimeToolResolution {
  executable: string
  source: RuntimeToolSource
}

export function resolveMpvExecutable(): RuntimeToolResolution {
  return resolveRuntimeTool('MPV_PATH', 'mpv.exe', 'mpv')
}

export function resolveFfmpegExecutable(): RuntimeToolResolution {
  return resolveRuntimeTool('FFMPEG_PATH', 'ffmpeg.exe', 'ffmpeg')
}

function resolveRuntimeTool(
  environmentVariable: string,
  windowsExecutableName: string,
  pathCommand: string
): RuntimeToolResolution {
  const override = process.env[environmentVariable]?.trim()
  if (override) {
    return { executable: override, source: 'environment' }
  }

  return {
    executable: process.platform === 'win32' ? windowsExecutableName : pathCommand,
    source: 'path'
  }
}
