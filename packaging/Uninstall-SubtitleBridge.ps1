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

function Assert-OwnedInstallation {
  param([Parameter(Mandatory = $true)][string]$Directory)

  $markerPath = Join-Path $Directory '.subtitle-bridge-install.json'
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "Refusing to uninstall a directory without a Subtitle Bridge ownership marker: $Directory"
  }

  try {
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
  } catch {
    throw "The Subtitle Bridge ownership marker is unreadable: $markerPath"
  }

  $recorded = [System.IO.Path]::GetFullPath([string]$marker.installDir).TrimEnd('\').TrimEnd('/')
  if ($marker.version -ne 1 -or
      [string]$marker.application -ne 'Subtitle Bridge' -or
      -not $recorded.Equals($Directory, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The Subtitle Bridge ownership marker does not match this install directory: $Directory"
  }

  $requiredPaths = @(
    'Subtitle Bridge.exe',
    'Uninstall-SubtitleBridge.ps1',
    'resources\app\package.json'
  )
  foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $Directory $relativePath))) {
      throw "The target directory does not have the expected Subtitle Bridge installation structure: $Directory"
    }
  }

  try {
    $packageJson = Get-Content -LiteralPath (Join-Path $Directory 'resources\app\package.json') -Raw | ConvertFrom-Json
  } catch {
    throw 'The installed Subtitle Bridge package metadata is unreadable.'
  }

  if ([string]$packageJson.name -ne 'subtitle-bridge') {
    throw 'The target directory package metadata does not identify Subtitle Bridge.'
  }
}

function Remove-OwnedRuntimeCache {
  param([Parameter(Mandatory = $true)][string]$Directory)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }

  $markerPath = Join-Path $Directory '.subtitle-bridge-runtime-cache.json'
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    Write-Warning "Runtime cache was preserved because it has no Subtitle Bridge ownership marker: $Directory"
    return
  }

  try {
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    $recorded = [System.IO.Path]::GetFullPath([string]$marker.cacheDir).TrimEnd('\').TrimEnd('/')
  } catch {
    Write-Warning "Runtime cache was preserved because its ownership marker is unreadable: $Directory"
    return
  }

  if ($marker.version -ne 1 -or
      [string]$marker.application -ne 'Subtitle Bridge' -or
      -not $recorded.Equals($Directory, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Warning "Runtime cache was preserved because its ownership marker does not match the target directory: $Directory"
    return
  }

  foreach ($entry in @(Get-ChildItem -LiteralPath $Directory -Force)) {
    if ($entry.Name -eq '.subtitle-bridge-runtime-cache.json') {
      continue
    }

    $isKnownFile = (-not $entry.PSIsContainer) -and
      ($entry.Name -match '^(mpv|ffmpeg)-[0-9a-f]{64}\.zip(?:\.download)?$')
    $isKnownDirectory = $entry.PSIsContainer -and
      ($entry.Name -match '^(mpv|ffmpeg)-extracted-[0-9a-f]{64}$')

    if ($isKnownFile -or $isKnownDirectory) {
      Remove-Item -LiteralPath $entry.FullName -Recurse -Force
    }
  }

  Remove-Item -LiteralPath $markerPath -Force

  $remaining = @(Get-ChildItem -LiteralPath $Directory -Force)
  if ($remaining.Count -eq 0) {
    Remove-Item -LiteralPath $Directory -Force
  } else {
    Write-Warning "Unknown files were preserved in the former Subtitle Bridge runtime-cache directory: $Directory"
  }
}

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
  Assert-OwnedInstallation -Directory $InstallDir

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

  if (-not $KeepRuntimeCache) {
    Remove-OwnedRuntimeCache -Directory $RuntimeCacheDir
  }

  Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $UninstallRegistryPath -Recurse -Force -ErrorAction SilentlyContinue

  if (Test-Path -LiteralPath $InstallDir -PathType Container) {
    Assert-OwnedInstallation -Directory $InstallDir
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
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
