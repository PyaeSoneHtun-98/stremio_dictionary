import { describe, expect, it } from 'vitest'
import {
  INSTALL_DIRECTORY_ENV,
  UPDATE_PARENT_EXE_ENV,
  type WindowsDirectoryResolver,
} from '../src/main/update/installLaunch'
import { createInstallerSpawnOptions } from '../src/main/update/ipc'

const identityResolver: WindowsDirectoryResolver = (directoryPath) => directoryPath

describe('update IPC installer spawn options', () => {
  it('spawns setup detached with a safe cwd outside the install tree', () => {
    const installDirectory = 'D:\\Apps\\Subtitle Bridge'
    const executablePath = `${installDirectory}\\Subtitle Bridge.exe`
    const installerDirectory =
      'C:\\Users\\Tester\\AppData\\Roaming\\subtitle-bridge\\updates\\v1.0.7'
    const installerPath = `${installerDirectory}\\SubtitleBridge-Setup-x64.exe`

    const options = createInstallerSpawnOptions(
      installerPath,
      executablePath,
      identityResolver,
    )

    expect(options.detached).toBe(true)
    expect(options.stdio).toBe('ignore')
    expect(options.windowsHide).toBe(false)
    expect(options.cwd).toBe(installerDirectory)
    expect(options.env?.[INSTALL_DIRECTORY_ENV]).toBe(installDirectory)
    expect(options.env?.[UPDATE_PARENT_EXE_ENV]).toBe(executablePath)
  })

  it('propagates physical-path containment failures before spawn', () => {
    const installDirectory = 'D:\\Apps\\Subtitle Bridge'
    const executablePath = `${installDirectory}\\Subtitle Bridge.exe`
    const installerDirectory = 'C:\\Users\\Tester\\Downloads\\UpdateAlias'
    const installerPath = `${installerDirectory}\\SubtitleBridge-Setup-x64.exe`

    expect(() =>
      createInstallerSpawnOptions(installerPath, executablePath, (directoryPath) => {
        if (directoryPath === installerDirectory) {
          return `${installDirectory}\\updates\\v1.0.7`
        }
        return installDirectory
      }),
    ).toThrow('working directory must be outside')
  })
})
