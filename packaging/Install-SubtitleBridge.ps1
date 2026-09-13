param(
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Subtitle Bridge",
  [switch]$NoShortcut,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = (Resolve-Path $SourceDir).Path
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

if ($InstallDir.TrimEnd('\') -eq $SourceDir.TrimEnd('\')) {
  throw 'Choose an install directory different from the extracted package directory.'
}

Write-Host "Installing Subtitle Bridge to $InstallDir"
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

Get-ChildItem -LiteralPath $SourceDir -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $InstallDir -Recurse -Force
}

$ExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'
if (-not (Test-Path -LiteralPath $ExePath)) {
  throw 'Subtitle Bridge.exe was not found in the package.'
}

if (-not $NoShortcut) {
  $StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
  $ShortcutPath = Join-Path $StartMenuDir 'Subtitle Bridge.lnk'
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $ExePath
  $Shortcut.WorkingDirectory = $InstallDir
  $Shortcut.Description = 'Subtitle Bridge Player'
  $Shortcut.Save()
  Write-Host "Created Start Menu shortcut: $ShortcutPath"
}

Write-Host 'Subtitle Bridge installation completed.'

if (-not $NoLaunch) {
  Start-Process -FilePath $ExePath
}
