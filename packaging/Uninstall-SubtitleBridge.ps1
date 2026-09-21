param(
  [string]$InstallDir,
  [string]$RuntimeCacheDir,
  [string]$StremioServerJsPath,
  [switch]$KeepRuntimeCache,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SubtitleBridge'
$ShortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Subtitle Bridge.lnk'

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = $PSScriptRoot
}
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir).TrimEnd('\').TrimEnd('/')
$ExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'

if ([string]::IsNullOrWhiteSpace($RuntimeCacheDir) -and (Test-Path -LiteralPath $UninstallRegistryPath)) {
  $registeredCache = (Get-ItemProperty -LiteralPath $UninstallRegistryPath -ErrorAction SilentlyContinue).RuntimeCacheDir
  if (-not [string]::IsNullOrWhiteSpace([string]$registeredCache)) {
    $RuntimeCacheDir = [string]$registeredCache
  }
}
if ([string]::IsNullOrWhiteSpace($RuntimeCacheDir)) {
  $RuntimeCacheDir = Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\RuntimeCache'
}
$RuntimeCacheDir = [System.IO.Path]::GetFullPath($RuntimeCacheDir).TrimEnd('\').TrimEnd('/')

function Get-RunningInstalledProcesses {
  param([Parameter(Mandatory = $true)][string]$ExecutablePath)

  if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    return @()
  }

  $target = [System.IO.Path]::GetFullPath($ExecutablePath)
  $matches = New-Object System.Collections.Generic.List[object]

  try {
    Get-CimInstance Win32_Process -Filter "Name = 'Subtitle Bridge.exe'" -ErrorAction Stop |
      ForEach-Object {
        if ($_.ExecutablePath -and
            [System.IO.Path]::GetFullPath($_.ExecutablePath).Equals(
              $target,
              [System.StringComparison]::OrdinalIgnoreCase
            )) {
          $matches.Add($_)
        }
      }
  } catch {
    # If process inspection is unavailable, deletion below still fails safely on locked files.
  }

  return $matches
}

try {
  $disableHandoff = Join-Path $InstallDir 'Disable-StremioHandoff.ps1'
  if (Test-Path -LiteralPath $disableHandoff -PathType Leaf) {
    $handoffArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $disableHandoff)
    $handoffArgs += '-AllowMissing'
    if (-not [string]::IsNullOrWhiteSpace($StremioServerJsPath)) {
      $handoffArgs += @('-ServerJsPath', $StremioServerJsPath)
    }

    & powershell.exe @handoffArgs
    if ($LASTEXITCODE -ne 0) {
      $global:LASTEXITCODE = 0
      throw 'Could not remove the Stremio integration safely. Subtitle Bridge was not uninstalled so you can retry or repair the integration first.'
    }
  }

  foreach ($process in (Get-RunningInstalledProcesses -ExecutablePath $ExePath)) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
      throw 'Close Subtitle Bridge before uninstalling and try again.'
    }
  }

  Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $UninstallRegistryPath -Recurse -Force -ErrorAction SilentlyContinue

  if (Test-Path -LiteralPath $InstallDir -PathType Container) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
  }

  if (-not $KeepRuntimeCache -and (Test-Path -LiteralPath $RuntimeCacheDir -PathType Container)) {
    Remove-Item -LiteralPath $RuntimeCacheDir -Recurse -Force
  }

  if (-not $Quiet) {
    $shell = New-Object -ComObject WScript.Shell
    $shell.Popup('Subtitle Bridge was uninstalled.', 5, 'Subtitle Bridge', 64) | Out-Null
  }
} catch {
  if (-not $Quiet) {
    try {
      $shell = New-Object -ComObject WScript.Shell
      $shell.Popup($_.Exception.Message, 0, 'Subtitle Bridge uninstall failed', 16) | Out-Null
    } catch {
      # Fall through to the non-zero exit below.
    }
  }

  Write-Error $_
  exit 1
}
