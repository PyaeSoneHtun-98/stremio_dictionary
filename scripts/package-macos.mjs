import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') {
  throw new Error('macOS packaging must run on macOS.')
}

if (process.arch !== 'arm64') {
  throw new Error(`macOS beta packaging requires an arm64 Node/Electron runtime. Received: ${process.arch}`)
}

const PRODUCT_NAME = 'Subtitle Bridge'
const BUNDLE_IDENTIFIER = 'io.github.pyaesonehtun-98.subtitlebridge'
const EXECUTABLE_NAME = PRODUCT_NAME
const ICON_FILE = 'subtitle-bridge.icns'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const electronDist = join(root, 'node_modules', 'electron', 'dist')
const electronApp = join(electronDist, 'Electron.app')
const builtApp = join(root, 'out')
const brandingRoot = join(root, 'assets', 'branding')
const iconSource = join(brandingRoot, 'subtitle-bridge-icon.png')
const nativeVideoView = join(builtApp, 'native', 'mpv_view.node')
const releaseRoot = join(root, 'release')
const packageDir = join(releaseRoot, 'SubtitleBridge-macos-arm64')
const appBundle = join(packageDir, `${PRODUCT_NAME}.app`)
const dmgPath = join(releaseRoot, 'SubtitleBridge-macos-arm64.dmg')
const checksumPath = `${dmgPath}.sha256`

for (const requiredPath of [electronApp, builtApp, iconSource, nativeVideoView]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required build input is missing: ${requiredPath}`)
  }
}

rmSync(packageDir, { recursive: true, force: true })
rmSync(dmgPath, { force: true })
rmSync(checksumPath, { force: true })
mkdirSync(packageDir, { recursive: true })

// ditto preserves the framework symlinks inside Electron.app; a plain recursive copy does not.
execFileSync('ditto', [electronApp, appBundle], { stdio: 'inherit' })

const contents = join(appBundle, 'Contents')
const resources = join(contents, 'Resources')
const infoPlist = join(contents, 'Info.plist')

// Electron finds its helper apps by its own product name first, so only the main executable is
// renamed; the "Electron Helper*.app" bundles stay as shipped.
renameSync(join(contents, 'MacOS', 'Electron'), join(contents, 'MacOS', EXECUTABLE_NAME))
rmSync(join(resources, 'default_app.asar'), { force: true })

const appResources = join(resources, 'app')
mkdirSync(appResources, { recursive: true })
execFileSync('ditto', [builtApp, join(appResources, 'out')], { stdio: 'inherit' })
const packagedBranding = join(appResources, 'assets', 'branding')
mkdirSync(packagedBranding, { recursive: true })
copyFileSync(iconSource, join(packagedBranding, 'subtitle-bridge-icon.png'))
copyFileSync(join(brandingRoot, 'licenses', 'Inter-OFL.txt'), join(packagedBranding, 'Inter-OFL.txt'))
writeFileSync(
  join(appResources, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      productName: PRODUCT_NAME,
      version: packageJson.version,
      description: packageJson.description,
      main: 'out/main/index.js'
    },
    null,
    2
  )}\n`,
  'utf8'
)

buildIcns(iconSource, join(resources, ICON_FILE))

for (const [key, type, value] of [
  ['CFBundleExecutable', 'string', EXECUTABLE_NAME],
  ['CFBundleName', 'string', PRODUCT_NAME],
  ['CFBundleDisplayName', 'string', PRODUCT_NAME],
  ['CFBundleIdentifier', 'string', BUNDLE_IDENTIFIER],
  ['CFBundleShortVersionString', 'string', packageJson.version],
  ['CFBundleVersion', 'string', packageJson.version],
  ['CFBundleIconFile', 'string', ICON_FILE],
  ['LSApplicationCategoryType', 'string', 'public.app-category.entertainment']
]) {
  execFileSync('plutil', ['-replace', key, `-${type}`, value, infoPlist], { stdio: 'inherit' })
}

copyFileSync(join(root, 'LICENSE'), join(resources, 'LICENSE.txt'))

for (const file of ['LICENSE', 'LICENSES.chromium.html']) {
  const source = join(electronDist, file)
  if (existsSync(source)) {
    copyFileSync(source, join(resources, `Electron-${file}`))
  }
}

writeFileSync(
  join(resources, 'RUNTIME_DEPENDENCIES.txt'),
  [
    'Subtitle Bridge runtime dependencies (macOS beta)',
    '',
    'This app does not redistribute mpv or FFmpeg binaries.',
    'Install them with Homebrew before playing videos:',
    '',
    '  brew install mpv ffmpeg',
    '',
    'mpv runs inside the app as libmpv, loaded at runtime from:',
    '1. MPV_LIBRARY_PATH developer override',
    '2. Homebrew: /opt/homebrew/lib/libmpv.2.dylib, then /usr/local/lib/libmpv.2.dylib',
    '',
    'FFmpeg lookup order:',
    '1. FFMPEG_PATH developer override',
    '2. Homebrew: /opt/homebrew/bin, then /usr/local/bin',
    '3. system PATH fallback',
    ''
  ].join('\n'),
  'utf8'
)

writeFileSync(
  join(resources, 'BUILD_INFO.json'),
  `${JSON.stringify(
    {
      product: PRODUCT_NAME,
      version: packageJson.version,
      channel: 'beta',
      platform: 'darwin',
      arch: process.arch,
      createdAt: new Date().toISOString(),
      signing: 'ad-hoc',
      runtimeDependencies: {
        libmpv: { bundled: false, resolution: ['MPV_LIBRARY_PATH', 'homebrew'] },
        ffmpeg: { bundled: false, resolution: ['FFMPEG_PATH', 'homebrew', 'PATH'] }
      }
    },
    null,
    2
  )}\n`,
  'utf8'
)

// Renaming the executable and editing Info.plist invalidates Electron's signature. Apple Silicon
// refuses to run unsigned code, so re-sign ad hoc (no Developer ID available): first the native
// video view, which --deep does not reach inside Resources, then the whole bundle.
execFileSync(
  'codesign',
  ['--force', '--sign', '-', join(appResources, 'out', 'native', 'mpv_view.node')],
  { stdio: 'inherit' }
)
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appBundle], { stdio: 'inherit' })
execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appBundle], {
  stdio: 'inherit'
})

const dmgStaging = mkdtempSync(join(tmpdir(), 'subtitle-bridge-dmg-'))
try {
  execFileSync('ditto', [appBundle, join(dmgStaging, basename(appBundle))], { stdio: 'inherit' })
  symlinkSync('/Applications', join(dmgStaging, 'Applications'))
  execFileSync(
    'hdiutil',
    [
      'create',
      '-volname',
      PRODUCT_NAME,
      '-srcfolder',
      dmgStaging,
      '-fs',
      'HFS+',
      '-format',
      'UDZO',
      '-ov',
      dmgPath
    ],
    { stdio: 'inherit' }
  )
} finally {
  rmSync(dmgStaging, { recursive: true, force: true })
}

const digest = createHash('sha256').update(readFileSync(dmgPath)).digest('hex')
writeFileSync(checksumPath, `${digest}  ${basename(dmgPath)}\n`, 'utf8')

console.log(`Packaged: ${appBundle}`)
console.log(`Disk image: ${dmgPath}`)
console.log(`SHA-256:  ${digest}`)
console.log('Signing: ad hoc (not notarized)')
console.log('Bundled mpv/FFmpeg: no (install with Homebrew)')

function buildIcns(sourcePng, destination) {
  const workDirectory = mkdtempSync(join(tmpdir(), 'subtitle-bridge-icon-'))
  const iconset = join(workDirectory, 'subtitle-bridge.iconset')
  mkdirSync(iconset)
  try {
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        const pixels = String(size * scale)
        const name = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
        execFileSync('sips', ['-z', pixels, pixels, sourcePng, '--out', join(iconset, name)], {
          stdio: 'ignore'
        })
      }
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', destination], { stdio: 'inherit' })
  } finally {
    rmSync(workDirectory, { recursive: true, force: true })
  }
}
