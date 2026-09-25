import { describe, expect, it } from 'vitest'
import {
  createInstallerEnvironment,
  currentInstallDirectory,
  INSTALL_DIRECTORY_ENV,
  UPDATE_PARENT_EXE_ENV,
  UPDATE_PARENT_PID_ENV,
  UPDATE_PARENT_STARTED_AT_ENV
} from '../src/main/update/installLaunch'

describe('updater installer launch environment', () => {
  it('derives the custom install directory from the running Windows executable', () => {
    expect(
      currentInstallDirectory('D:\\Apps\\Subtitle Bridge Custom\\Subtitle Bridge.exe')
    ).toBe('D:\\Apps\\Subtitle Bridge Custom')
  })

  it('passes a complete updater process identity to setup', () => {
    const customInstallDirectory = 'D:\\Apps\\Subtitle Bridge Custom'
    const executablePath = customInstallDirectory + '\\Subtitle Bridge.exe'
    const environment = createInstallerEnvironment(
      customInstallDirectory,
      executablePath,
      { PATH: 'C:\\Windows\\System32' },
      4242,
      1_700_000_000_123
    )

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe(customInstallDirectory)
    expect(environment[UPDATE_PARENT_PID_ENV]).toBe('4242')
    expect(environment[UPDATE_PARENT_EXE_ENV]).toBe(executablePath)
    expect(environment[UPDATE_PARENT_STARTED_AT_ENV]).toBe('1700000000123')
    expect(environment.PATH).toBe('C:\\Windows\\System32')
  })

  it('overrides inherited updater handoff values case-insensitively', () => {
    const installDirectory = 'E:\\Portable\\Subtitle Bridge'
    const executablePath = installDirectory + '\\Subtitle Bridge.exe'
    const environment = createInstallerEnvironment(
      installDirectory,
      executablePath,
      {
        subtitle_bridge_install_dir: 'C:\\Old Install',
        subtitle_bridge_update_parent_pid: '999',
        subtitle_bridge_update_parent_exe: 'C:\\Wrong\\Other.exe',
        subtitle_bridge_update_parent_started_at_ms: '1',
        PATH: 'C:\\Windows'
      },
      1234,
      1_700_000_000_456
    )

    expect(environment[INSTALL_DIRECTORY_ENV]).toBe(installDirectory)
    expect(environment[UPDATE_PARENT_PID_ENV]).toBe('1234')
    expect(environment[UPDATE_PARENT_EXE_ENV]).toBe(executablePath)
    expect(environment[UPDATE_PARENT_STARTED_AT_ENV]).toBe('1700000000456')
    expect(environment.subtitle_bridge_install_dir).toBeUndefined()
    expect(environment.subtitle_bridge_update_parent_pid).toBeUndefined()
    expect(environment.subtitle_bridge_update_parent_exe).toBeUndefined()
    expect(environment.subtitle_bridge_update_parent_started_at_ms).toBeUndefined()
  })

  it('rejects invalid process identity values', () => {
    const installDirectory = 'C:\\Subtitle Bridge'
    const executablePath = installDirectory + '\\Subtitle Bridge.exe'

    expect(() => currentInstallDirectory('Subtitle Bridge.exe')).toThrow(
      'executable path is invalid'
    )
    expect(() =>
      createInstallerEnvironment('Subtitle Bridge', executablePath, {}, 1, 1)
    ).toThrow('install directory is invalid')
    expect(() =>
      createInstallerEnvironment(installDirectory, 'Subtitle Bridge.exe', {}, 1, 1)
    ).toThrow('executable path is invalid')
    expect(() =>
      createInstallerEnvironment(
        installDirectory,
        'D:\\Other\\Subtitle Bridge.exe',
        {},
        1,
        1
      )
    ).toThrow('outside the install directory')
    expect(() =>
      createInstallerEnvironment(installDirectory, executablePath, {}, 0, 1)
    ).toThrow('process ID is invalid')
    expect(() =>
      createInstallerEnvironment(installDirectory, executablePath, {}, 1, 0)
    ).toThrow('process start time is invalid')
  })
})
