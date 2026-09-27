import { realpathSync } from 'node:fs'
import { win32 } from 'node:path'
import { performance } from 'node:perf_hooks'

export const INSTALL_DIRECTORY_ENV = 'SUBTITLE_BRIDGE_INSTALL_DIR'
export const UPDATE_PARENT_PID_ENV = 'SUBTITLE_BRIDGE_UPDATE_PARENT_PID'
export const UPDATE_PARENT_EXE_ENV = 'SUBTITLE_BRIDGE_UPDATE_PARENT_EXE'
export const UPDATE_PARENT_STARTED_AT_ENV = 'SUBTITLE_BRIDGE_UPDATE_PARENT_STARTED_AT_MS'

export type WindowsDirectoryResolver = (directoryPath: string) => string

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

export function installerWorkingDirectory(
  installerPath: string,
  installDirectory: string,
  resolveDirectory: WindowsDirectoryResolver = resolvePhysicalWindowsDirectory,
): string {
  if (!installerPath || !win32.isAbsolute(installerPath)) {
    throw new Error('The update installer path is invalid.')
  }
  if (!installDirectory || !win32.isAbsolute(installDirectory)) {
    throw new Error('The current Subtitle Bridge install directory is invalid.')
  }

  const workingDirectory = win32.dirname(installerPath)
  const resolvedInstallDirectory = resolveDirectorySafely(
    installDirectory,
    resolveDirectory,
    'install directory',
  )
  const resolvedWorkingDirectory = resolveDirectorySafely(
    workingDirectory,
    resolveDirectory,
    'update installer directory',
  )

  if (isWindowsPathInsideOrEqual(resolvedInstallDirectory, resolvedWorkingDirectory)) {
    throw new Error('The update installer working directory must be outside the install directory.')
  }

  return resolvedWorkingDirectory
}

export function createInstallerEnvironment(
  installDirectory: string,
  updateParentExecutablePath: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  updateParentPid: number = process.pid,
  updateParentStartedAtMs: number = Math.trunc(performance.timeOrigin),
): NodeJS.ProcessEnv {
  if (!installDirectory || !win32.isAbsolute(installDirectory)) {
    throw new Error('The current Subtitle Bridge install directory is invalid.')
  }
  if (!updateParentExecutablePath || !win32.isAbsolute(updateParentExecutablePath)) {
    throw new Error('The current Subtitle Bridge executable path is invalid.')
  }
  if (
    win32.dirname(updateParentExecutablePath).toLowerCase() !== installDirectory.toLowerCase()
  ) {
    throw new Error('The current Subtitle Bridge executable is outside the install directory.')
  }
  if (!Number.isSafeInteger(updateParentPid) || updateParentPid <= 0) {
    throw new Error('The current Subtitle Bridge process ID is invalid.')
  }
  if (!Number.isSafeInteger(updateParentStartedAtMs) || updateParentStartedAtMs <= 0) {
    throw new Error('The current Subtitle Bridge process start time is invalid.')
  }

  const environment: NodeJS.ProcessEnv = {}
  const reservedKeys = new Set([
    INSTALL_DIRECTORY_ENV,
    UPDATE_PARENT_PID_ENV,
    UPDATE_PARENT_EXE_ENV,
    UPDATE_PARENT_STARTED_AT_ENV,
  ])
  for (const [key, value] of Object.entries(baseEnvironment)) {
    if (!reservedKeys.has(key.toUpperCase())) {
      environment[key] = value
    }
  }

  environment[INSTALL_DIRECTORY_ENV] = installDirectory
  environment[UPDATE_PARENT_PID_ENV] = String(updateParentPid)
  environment[UPDATE_PARENT_EXE_ENV] = updateParentExecutablePath
  environment[UPDATE_PARENT_STARTED_AT_ENV] = String(updateParentStartedAtMs)
  return environment
}

function resolvePhysicalWindowsDirectory(directoryPath: string): string {
  return realpathSync.native(directoryPath)
}

function resolveDirectorySafely(
  directoryPath: string,
  resolveDirectory: WindowsDirectoryResolver,
  label: string,
): string {
  let resolvedPath: string
  try {
    resolvedPath = resolveDirectory(directoryPath)
  } catch {
    throw new Error(`The ${label} could not be resolved safely.`)
  }

  const normalizedPath = normalizePhysicalWindowsPath(resolvedPath)
  if (!win32.isAbsolute(normalizedPath)) {
    throw new Error(`The ${label} could not be resolved safely.`)
  }

  return normalizedPath
}

function normalizePhysicalWindowsPath(pathValue: string): string {
  const normalizedPath = win32.normalize(pathValue)

  if (normalizedPath.startsWith('\\\\?\\UNC\\')) {
    return `\\\\${normalizedPath.slice(8)}`
  }
  if (normalizedPath.startsWith('\\\\?\\')) {
    return normalizedPath.slice(4)
  }

  return normalizedPath
}

function isWindowsPathInsideOrEqual(rootPath: string, candidatePath: string): boolean {
  const relativePath = win32.relative(rootPath.toLowerCase(), candidatePath.toLowerCase())
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..\\') &&
      relativePath !== '..' &&
      !win32.isAbsolute(relativePath))
  )
}
