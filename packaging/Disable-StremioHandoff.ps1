$ErrorActionPreference = 'Stop'

$ProtocolKey = 'HKCU:\Software\Classes\vlc'
$MarkerName = 'SubtitleBridgeCompatibility'
$BackupDir = Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\stremio-handoff'
$BackupPath = Join-Path $BackupDir 'vlc-protocol-before-subtitle-bridge.reg'

if (-not (Test-Path -LiteralPath $ProtocolKey)) {
  Write-Host 'No current-user vlc:// protocol registration is present.'
  exit 0
}

$Existing = Get-ItemProperty -LiteralPath $ProtocolKey -ErrorAction SilentlyContinue
if ($Existing.$MarkerName -ne '1') {
  throw 'The current-user vlc:// protocol registration is not owned by Subtitle Bridge. Nothing was changed.'
}

Remove-Item -LiteralPath $ProtocolKey -Recurse -Force

if (Test-Path -LiteralPath $BackupPath) {
  & reg.exe import $BackupPath | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Subtitle Bridge registration was removed, but the previous vlc:// registration could not be restored automatically. Backup retained at: $BackupPath"
  }

  Remove-Item -LiteralPath $BackupPath -Force
  Write-Host 'Subtitle Bridge Stremio compatibility was disabled and the previous current-user vlc:// registration was restored.'
} else {
  Write-Host 'Subtitle Bridge Stremio compatibility was disabled. Windows will fall back to any system-level vlc:// registration.'
}
