import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  throw new Error('Windows setup packaging must run on Windows.')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseRoot = join(root, 'release')
const packagingRoot = join(root, 'packaging')
const payloadZip = join(releaseRoot, 'SubtitleBridge-win-x64.zip')
const bootstrapSource = join(packagingRoot, 'SetupBootstrap.cs')
const setupExe = join(releaseRoot, 'SubtitleBridge-Setup-x64.exe')
const setupChecksum = `${setupExe}.sha256`

for (const requiredPath of [payloadZip, bootstrapSource]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required setup input is missing: ${requiredPath}`)
  }
}

rmSync(setupExe, { force: true })
rmSync(setupChecksum, { force: true })

const compilerCandidates = [
  join(process.env.SystemRoot ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  join(process.env.SystemRoot ?? 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
]
const csc = compilerCandidates.find((candidate) => existsSync(candidate))
if (!csc) {
  throw new Error('The .NET Framework C# compiler (csc.exe) is required to build the Windows setup.')
}

execFileSync(
  csc,
  [
    '/nologo',
    '/target:winexe',
    '/platform:x64',
    `/out:${setupExe}`,
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.IO.Compression.dll',
    '/reference:System.IO.Compression.FileSystem.dll',
    bootstrapSource
  ],
  {
    cwd: root,
    stdio: 'inherit'
  }
)

if (!existsSync(setupExe)) {
  throw new Error('The setup bootstrap compiler did not produce SubtitleBridge-Setup-x64.exe.')
}

const payloadLength = statSync(payloadZip).size
appendFileSync(setupExe, readFileSync(payloadZip))

const footer = Buffer.alloc(16)
footer.write('SBSETUP1', 0, 8, 'ascii')
footer.writeBigInt64LE(BigInt(payloadLength), 8)
appendFileSync(setupExe, footer)

const digest = createHash('sha256').update(readFileSync(setupExe)).digest('hex')
writeFileSync(setupChecksum, `${digest}  SubtitleBridge-Setup-x64.exe\r\n`, 'utf8')

console.log(`Setup:   ${setupExe}`)
console.log(`Payload: ${payloadLength} bytes`)
console.log(`SHA-256: ${digest}`)
