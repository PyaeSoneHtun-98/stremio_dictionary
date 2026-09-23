import { describe, expect, it } from 'vitest'
import {
  createInstallerEnvironment,
  currentInstallDirectory,
  INSTALL_DIRECTORY_ENV
} from '../src/main/update/installLaunch'

describe('updater installer launch environment', () => {
  it('derives the custom install directory from the running Windows executable', () => {
    expect(
      currentInstallDirectory('D:\\Apps\\Subtitle Bridge Custom\\Subtitle Bridge.exe')
    ).toBe('D:\\Apps\\Subtitle Bridge Custom')
  })

  it('passes the current custom installation directory to the setup bootstrap', () => {
    const customInstallDirectory = 'D:\\Apps\\Subtitle Bridge Custom'
    const environment = createInstallerEnvironment(customInstallDirectory, {
      PATH: 'C:\\Windows\\System32'
    })

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe(customInstallDirectory)
    expect(environment.PATH).toBe('C:\\Windows\\System32')
  })

  it('overrides any inherited install-directory value case-insensitively', () => {
    const environment = createInstallerEnvironment('E:\\Portable\\Subtitle Bridge', {
      subtitle_bridge_install_dir: 'C:\\Old Install',
      PATH: 'C:\\Windows'
    })

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe('E:\\Portable\\Subtitle Bridge')
    expect(environment.subtitle_bridge_install_dir).toBeUndefined()
  })

  it('rejects a non-absolute executable or installation directory', () => {
    expect(() => currentInstallDirectory('Subtitle Bridge.exe')).toThrow(
      'executable path is invalid'
    )
    expect(() => createInstallerEnvironment('Subtitle Bridge', {})).toThrow(
      'install directory is invalid'
    )
  })
})
