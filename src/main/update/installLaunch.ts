import { win32 } from 'node:path'

export const INSTALL_DIRECTORY_ENV = 'SUBTITLE_BRIDGE_INSTALL_DIR'

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
  baseEnvironment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  if (!installDirectory || !win32.isAbsolute(installDirectory)) {
    throw new Error('The current Subtitle Bridge install directory is invalid.')
  }

  const environment: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(baseEnvironment)) {
    if (key.toUpperCase() !== INSTALL_DIRECTORY_ENV) {
      environment[key] = value
    }
  }

  environment[INSTALL_DIRECTORY_ENV] = installDirectory
  return environment
}
