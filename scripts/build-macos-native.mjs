// Builds the macOS in-process video view (native/macos/mpv_view.mm) into out/native/mpv_view.node.
// Node-API keeps the module ABI-stable, so it is compiled against the running Node's headers and
// loads in Electron. libmpv is not linked: only its headers are needed (Homebrew `mpv`), and the
// app loads the library at runtime.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') {
  throw new Error('The macOS video view must be built on macOS.')
}

if (process.arch !== 'arm64') {
  throw new Error(`The macOS beta video view requires arm64. Received: ${process.arch}`)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'native', 'macos', 'mpv_view.mm')
const output = join(root, 'out', 'native', 'mpv_view.node')
const nodeInclude = resolve(dirname(process.execPath), '..', 'include', 'node')
const mpvInclude = process.env.MPV_INCLUDE_DIR?.trim() || join(homebrewPrefix(), 'include')

if (!existsSync(join(nodeInclude, 'node_api.h'))) {
  throw new Error(`Node-API headers were not found next to this Node runtime: ${nodeInclude}`)
}
if (!existsSync(join(mpvInclude, 'mpv', 'render_gl.h'))) {
  throw new Error('mpv headers were not found. Install them with: brew install mpv')
}

mkdirSync(dirname(output), { recursive: true })
const result = spawnSync(
  'clang++',
  [
    '-std=c++17',
    '-ObjC++',
    '-fobjc-arc',
    '-O2',
    '-Wall',
    '-Wextra',
    '-Wno-unused-parameter',
    '-arch',
    'arm64',
    '-mmacosx-version-min=11.0',
    '-shared',
    '-undefined',
    'dynamic_lookup',
    '-I',
    nodeInclude,
    '-I',
    mpvInclude,
    '-framework',
    'Cocoa',
    '-framework',
    'OpenGL',
    '-framework',
    'QuartzCore',
    '-o',
    output,
    source
  ],
  { encoding: 'utf8' }
)

process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
if (result.status !== 0) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const errors = (result.stderr ?? '').split('\n').filter((line) => / error: /.test(line))
    for (const line of errors.slice(0, 15)) {
      console.log(`::error title=native build::${line.replace(/^.*native\/macos\//, '').replace(/[\r\n%]/g, ' ')}`)
    }
  }
  throw new Error(`clang++ failed with status ${result.status ?? result.signal}`)
}

console.log(`Built: ${output}`)

function homebrewPrefix() {
  try {
    return execFileSync('brew', ['--prefix'], { encoding: 'utf8' }).trim()
  } catch {
    return '/opt/homebrew'
  }
}
