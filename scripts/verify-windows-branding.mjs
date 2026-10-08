import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertEmbeddedWindowsIcon } from './windows-icon.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageDir = resolve(process.argv[2] ?? join(root, 'release', 'SubtitleBridge-win-x64'))
const setupExe = resolve(process.argv[3] ?? join(root, 'release', 'SubtitleBridge-Setup-x64.exe'))
const brandingRoot = join(root, 'assets', 'branding')
const icon = join(brandingRoot, 'subtitle-bridge-icon.ico')

assertEmbeddedWindowsIcon(join(packageDir, 'Subtitle Bridge.exe'), icon)
assertEmbeddedWindowsIcon(setupExe, icon)
for (const file of ['subtitle-bridge-icon.ico', 'subtitle-bridge-icon.png']) {
  assert.deepEqual(
    readFileSync(join(packageDir, 'resources', 'app', 'assets', 'branding', file)),
    readFileSync(join(brandingRoot, file)),
    'Packaged native window icon must match the approved source.',
  )
}
assert.deepEqual(
  readFileSync(join(packageDir, 'resources', 'app', 'assets', 'branding', 'Inter-OFL.txt')),
  readFileSync(join(brandingRoot, 'licenses', 'Inter-OFL.txt')),
)
console.log(
  'Windows branding verified: app/setup resource frames and packaged window icons match approved artwork.',
)
