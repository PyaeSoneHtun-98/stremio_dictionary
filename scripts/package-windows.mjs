import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  throw new Error('Windows packaging must run on Windows.')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const electronDist = join(root, 'node_modules', 'electron', 'dist')
const builtApp = join(root, 'out')
const releaseRoot = join(root, 'release')
const packageDir = join(releaseRoot, 'SubtitleBridge-win-x64')
const zipPath = join(releaseRoot, 'SubtitleBridge-win-x64.zip')
const checksumPath = `${zipPath}.sha256`

for (const requiredPath of [electronDist, builtApp]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required build input is missing: ${requiredPath}`)
  }
}

rmSync(packageDir, { recursive: true, force: true })
rmSync(zipPath, { force: true })
rmSync(checksumPath, { force: true })
mkdirSync(releaseRoot, { recursive: true })
cpSync(electronDist, packageDir, { recursive: true })

const electronExe = join(packageDir, 'electron.exe')
const appExe = join(packageDir, 'Subtitle Bridge.exe')
if (!existsSync(electronExe)) {
  throw new Error('Electron runtime did not contain electron.exe.')
}
renameSync(electronExe, appExe)

const appResources = join(packageDir, 'resources', 'app')
mkdirSync(appResources, { recursive: true })
cpSync(builtApp, join(appResources, 'out'), { recursive: true })
writeFileSync(
  join(appResources, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      productName: 'Subtitle Bridge',
      version: packageJson.version,
      description: packageJson.description,
      main: 'out/main/index.js'
    },
    null,
    2
  )}\n`,
  'utf8'
)

copyFileSync(
  join(root, 'packaging', 'Install-SubtitleBridge.ps1'),
  join(packageDir, 'Install-SubtitleBridge.ps1')
)

const bundledTools = {
  mpv: bundleTool('MPV_PATH', 'mpv.exe', join(packageDir, 'resources', 'tools', 'mpv', 'mpv.exe')),
  ffmpeg: bundleTool(
    'FFMPEG_PATH',
    'ffmpeg.exe',
    join(packageDir, 'resources', 'tools', 'ffmpeg', 'ffmpeg.exe')
  )
}

const toolsReadme = [
  'Subtitle Bridge playback runtime tools',
  '',
  'If mpv.exe and ffmpeg.exe are present in these folders, the packaged app uses them automatically.',
  'If they are not bundled, install mpv and FFmpeg on Windows and add them to PATH, or set MPV_PATH and FFMPEG_PATH before launching.',
  '',
  `mpv bundled: ${bundledTools.mpv ? 'yes' : 'no'}`,
  `FFmpeg bundled: ${bundledTools.ffmpeg ? 'yes' : 'no'}`,
  ''
].join('\r\n')
const toolsRoot = join(packageDir, 'resources', 'tools')
mkdirSync(toolsRoot, { recursive: true })
writeFileSync(join(toolsRoot, 'README.txt'), toolsReadme, 'utf8')

writeFileSync(
  join(packageDir, 'BUILD_INFO.json'),
  `${JSON.stringify(
    {
      product: 'Subtitle Bridge',
      version: packageJson.version,
      platform: 'win32',
      arch: 'x64',
      createdAt: new Date().toISOString(),
      bundledTools
    },
    null,
    2
  )}\n`,
  'utf8'
)

execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -LiteralPath '${escapePowerShell(packageDir)}' -DestinationPath '${escapePowerShell(zipPath)}' -Force`
  ],
  { stdio: 'inherit' }
)

const zipBytes = readFileSync(zipPath)
const digest = createHash('sha256').update(zipBytes).digest('hex')
writeFileSync(checksumPath, `${digest}  ${zipPath.split(/[\\/]/).pop()}\r\n`, 'utf8')

console.log(`Packaged: ${packageDir}`)
console.log(`Archive:  ${zipPath}`)
console.log(`SHA-256:  ${digest}`)
console.log(`Bundled mpv: ${bundledTools.mpv ? 'yes' : 'no'}`)
console.log(`Bundled FFmpeg: ${bundledTools.ffmpeg ? 'yes' : 'no'}`)

function bundleTool(environmentVariable, executableName, destination) {
  const source = resolveTool(environmentVariable, executableName)
  if (!source) {
    return false
  }

  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  return true
}

function resolveTool(environmentVariable, executableName) {
  const explicit = process.env[environmentVariable]?.trim()
  if (explicit && existsSync(explicit)) {
    return explicit
  }

  try {
    const output = execFileSync('where.exe', [executableName], { encoding: 'utf8' })
    const firstMatch = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && existsSync(line))
    return firstMatch ?? null
  } catch {
    return null
  }
}

function escapePowerShell(value) {
  return value.replaceAll("'", "''")
}
