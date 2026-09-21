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

if (process.arch !== 'x64') {
  throw new Error(`Windows MVP packaging requires an x64 Node/Electron runtime. Received: ${process.arch}`)
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

for (const helper of [
  'Install-SubtitleBridge.ps1',
  'Install-RuntimeTools.ps1',
  'Uninstall-SubtitleBridge.ps1',
  'Enable-StremioHandoff.ps1',
  'Disable-StremioHandoff.ps1'
]) {
  copyFileSync(join(root, 'packaging', helper), join(packageDir, helper))
}

copyFileSync(
  join(root, 'packaging', 'runtime-manifest.json'),
  join(packageDir, 'RUNTIME_MANIFEST.json')
)

writeFileSync(
  join(packageDir, 'RUNTIME_DEPENDENCIES.txt'),
  [
    'Subtitle Bridge runtime dependencies',
    '',
    'The portable package does not redistribute mpv or FFmpeg binaries.',
    'The normal Windows installer provisions pinned, SHA-256-verified app-local runtime builds',
    'from the sources recorded in RUNTIME_MANIFEST.json.',
    '',
    'Runtime lookup order:',
    '1. MPV_PATH / FFMPEG_PATH developer override',
    '2. installer-managed app-local runtime',
    '3. system PATH fallback',
    '',
    'A raw portable ZIP therefore still requires either managed tools to be added manually',
    'under resources\\tools or compatible tools available through the developer overrides/PATH.',
    ''
  ].join('\r\n'),
  'utf8'
)

writeFileSync(
  join(packageDir, 'BUILD_INFO.json'),
  `${JSON.stringify(
    {
      product: 'Subtitle Bridge',
      version: packageJson.version,
      platform: 'win32',
      arch: process.arch,
      createdAt: new Date().toISOString(),
      runtimeDependencies: {
        mpv: {
          bundled: false,
          installerProvisioned: true,
          resolution: ['MPV_PATH', 'managed-app-local', 'PATH']
        },
        ffmpeg: {
          bundled: false,
          installerProvisioned: true,
          resolution: ['FFMPEG_PATH', 'managed-app-local', 'PATH']
        }
      }
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
console.log('Bundled mpv: no (normal installer provisions a pinned managed runtime)')
console.log('Bundled FFmpeg: no (normal installer provisions a pinned managed runtime)')

function escapePowerShell(value) {
  return value.replaceAll("'", "''")
}
