import { win32 } from 'node:path'

export const INSTALL_DIRECTORY_ENV = 'SUBTITLE_BRIDGE_INSTALL_DIR'
export const UPDATE_PARENT_PID_ENV = 'SUBTITLE_BRIDGE_UPDATE_PARENT_PID'

export function currentInstallDirectory(executablePath: string): string {
  if (!executablePath || !win32.isAbsolute(executablePath)) {
    throw new Error('The current Subtitle Bridge executable path is invalid.')
  }

  const installDirectory = win32.dirname(executablePath)
  if (!installDirectory || installDirectory === executablePath) {
    throw new Error('The current Subtitle Bridge install directory is invalid.')
  }

  return installDirectory
}

export function createInstallerEnvironment(
  installDirectory: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  updateParentPid: number = process.pid
): NodeJS.ProcessEnv {
  if (!installDirectory || !win32.isAbsolute(installDirectory)) {
    throw new Error('The current Subtitle Bridge install directory is invalid.')
  }
  if (!Number.isSafeInteger(updateParentPid) || updateParentPid <= 0) {
    throw new Error('The current Subtitle Bridge process ID is invalid.')
  }

  const environment: NodeJS.ProcessEnv = {}
  const reservedKeys = new Set([INSTALL_DIRECTORY_ENV, UPDATE_PARENT_PID_ENV])
  for (const [key, value] of Object.entries(baseEnvironment)) {
    if (!reservedKeys.has(key.toUpperCase())) {
      environment[key] = value
    }
  }

  environment[INSTALL_DIRECTORY_ENV] = installDirectory
  environment[UPDATE_PARENT_PID_ENV] = String(updateParentPid)
  return environment
}
