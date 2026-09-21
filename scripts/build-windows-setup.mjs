import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  throw new Error('Windows setup packaging must run on Windows.')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseRoot = join(root, 'release')
const packagingRoot = join(root, 'packaging')
const payloadZip = join(releaseRoot, 'SubtitleBridge-win-x64.zip')
const bootstrapScript = join(packagingRoot, 'Setup-SubtitleBridge.ps1')
const setupExe = join(releaseRoot, 'SubtitleBridge-Setup-x64.exe')
const setupChecksum = `${setupExe}.sha256`
const sedPath = join(releaseRoot, 'SubtitleBridge-Setup-x64.sed')

for (const requiredPath of [payloadZip, bootstrapScript]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required setup input is missing: ${requiredPath}`)
  }
}

rmSync(setupExe, { force: true })
rmSync(setupChecksum, { force: true })
rmSync(sedPath, { force: true })

const sed = [
  '[Version]',
  'Class=IEXPRESS',
  'SEDVersion=3',
  '[Options]',
  'PackagePurpose=InstallApp',
  'ShowInstallProgramWindow=0',
  'HideExtractAnimation=0',
  'UseLongFileName=1',
  'InsideCompressed=0',
  'CAB_FixedSize=0',
  'CAB_ResvCodeSigning=0',
  'RebootMode=N',
  'InstallPrompt=%InstallPrompt%',
  'DisplayLicense=%DisplayLicense%',
  'FinishMessage=%FinishMessage%',
  'TargetName=%TargetName%',
  'FriendlyName=%FriendlyName%',
  'AppLaunched=%AppLaunched%',
  'PostInstallCmd=%PostInstallCmd%',
  'AdminQuietInstCmd=%AdminQuietInstCmd%',
  'UserQuietInstCmd=%UserQuietInstCmd%',
  'SourceFiles=SourceFiles',
  '[Strings]',
  'InstallPrompt=',
  'DisplayLicense=',
  'FinishMessage=',
  `TargetName=${setupExe}`,
  'FriendlyName=Subtitle Bridge Setup',
  'AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "Setup-SubtitleBridge.ps1"',
  'PostInstallCmd=<None>',
  'AdminQuietInstCmd=',
  'UserQuietInstCmd=',
  'FILE0="Setup-SubtitleBridge.ps1"',
  'FILE1="SubtitleBridge-win-x64.zip"',
  '[SourceFiles]',
  `SourceFiles0=${ensureTrailingBackslash(packagingRoot)}`,
  `SourceFiles1=${ensureTrailingBackslash(releaseRoot)}`,
  '[SourceFiles0]',
  '%FILE0%=',
  '[SourceFiles1]',
  '%FILE1%=',
  ''
].join('\r\n')

writeFileSync(sedPath, sed, 'utf8')

const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
const iexpressPath = join(systemRoot, 'System32', 'iexpress.exe')
const iexpress = existsSync(iexpressPath) ? iexpressPath : 'iexpress.exe'

execFileSync(iexpress, ['/N', '/Q', '/M', sedPath], {
  cwd: root,
  stdio: 'inherit'
})

if (!existsSync(setupExe)) {
  throw new Error('IExpress did not produce SubtitleBridge-Setup-x64.exe.')
}

const digest = createHash('sha256').update(readFileSync(setupExe)).digest('hex')
writeFileSync(setupChecksum, `${digest}  SubtitleBridge-Setup-x64.exe\r\n`, 'utf8')
rmSync(sedPath, { force: true })

console.log(`Setup:   ${setupExe}`)
console.log(`SHA-256: ${digest}`)

function ensureTrailingBackslash(value) {
  return value.endsWith('\\') ? value : `${value}\\`
}
