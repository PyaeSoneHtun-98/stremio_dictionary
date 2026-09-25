import { describe, expect, it } from 'vitest'
import {
  createInstallerEnvironment,
  currentInstallDirectory,
  INSTALL_DIRECTORY_ENV,
  UPDATE_PARENT_PID_ENV
} from '../src/main/update/installLaunch'

describe('updater installer launch environment', () => {
  it('derives the custom install directory from the running Windows executable', () => {
    expect(
      currentInstallDirectory('D:\\Apps\\Subtitle Bridge Custom\\Subtitle Bridge.exe')
    ).toBe('D:\\Apps\\Subtitle Bridge Custom')
  })

  it('passes the current install directory and updater process ID to setup', () => {
    const customInstallDirectory = 'D:\\Apps\\Subtitle Bridge Custom'
    const environment = createInstallerEnvironment(
      customInstallDirectory,
      { PATH: 'C:\\Windows\\System32' },
      4242
    )

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe(customInstallDirectory)
    expect(environment[UPDATE_PARENT_PID_ENV]).toBe('4242')
    expect(environment.PATH).toBe('C:\\Windows\\System32')
  })

  it('overrides inherited updater handoff values case-insensitively', () => {
    const environment = createInstallerEnvironment(
      'E:\\Portable\\Subtitle Bridge',
      {
        subtitle_bridge_install_dir: 'C:\\Old Install',
        subtitle_bridge_update_parent_pid: '999',
        PATH: 'C:\\Windows'
      },
      1234
    )

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe('E:\\Portable\\Subtitle Bridge')
    expect(environment[UPDATE_PARENT_PID_ENV]).toBe('1234')
    expect(environment.subtitle_bridge_install_dir).toBeUndefined()
    expect(environment.subtitle_bridge_update_parent_pid).toBeUndefined()
  })

  it('rejects invalid executable, installation directory, or updater process ID', () => {
    expect(() => currentInstallDirectory('Subtitle Bridge.exe')).toThrow(
      'executable path is invalid'
    )
    expect(() => createInstallerEnvironment('Subtitle Bridge', {}, 1)).toThrow(
      'install directory is invalid'
    )
    expect(() => createInstallerEnvironment('C:\\Subtitle Bridge', {}, 0)).toThrow(
      'process ID is invalid'
    )
  })
})
