param(
  [string]$ExecutablePath = (Join-Path $PSScriptRoot 'Subtitle Bridge.exe')
)

$ErrorActionPreference = 'Stop'

$ExecutablePath = [System.IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
  throw "Subtitle Bridge executable was not found: $ExecutablePath"
}

$ProtocolKey = 'HKCU:\Software\Classes\vlc'
$ProtocolRegistryPath = 'HKCU\Software\Classes\vlc'
$MarkerName = 'SubtitleBridgeCompatibility'
$BackupDir = Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\stremio-handoff'
$BackupPath = Join-Path $BackupDir 'vlc-protocol-before-subtitle-bridge.reg'

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$ExistingIsOurs = $false
if (Test-Path -LiteralPath $ProtocolKey) {
  $Existing = Get-ItemProperty -LiteralPath $ProtocolKey -ErrorAction SilentlyContinue
  $ExistingIsOurs = $Existing.$MarkerName -eq '1'

  if (-not $ExistingIsOurs -and -not (Test-Path -LiteralPath $BackupPath)) {
    & reg.exe export $ProtocolRegistryPath $BackupPath /y | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'Could not back up the existing current-user vlc:// protocol registration.'
    }
  }
}

New-Item -Path $ProtocolKey -Force | Out-Null
Set-Item -LiteralPath $ProtocolKey -Value 'URL:Subtitle Bridge Stremio compatibility'
New-ItemProperty -LiteralPath $ProtocolKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath $ProtocolKey -Name $MarkerName -Value '1' -PropertyType String -Force | Out-Null

$CommandKey = Join-Path $ProtocolKey 'shell\open\command'
New-Item -Path $CommandKey -Force | Out-Null
Set-Item -LiteralPath $CommandKey -Value ('"{0}" "%1"' -f $ExecutablePath).Replace('\"', '"')

Write-Host 'Subtitle Bridge now handles vlc:// links for the current Windows user.'
Write-Host 'In Stremio: Settings -> Player -> External Player -> VLC.'
Write-Host 'Run Disable-StremioHandoff.ps1 to undo this compatibility registration.'
if (Test-Path -LiteralPath $BackupPath) {
  Write-Host "Previous current-user vlc:// registration backup: $BackupPath"
}
