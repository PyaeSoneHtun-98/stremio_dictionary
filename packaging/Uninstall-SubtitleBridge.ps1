param(
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Subtitle Bridge",
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir).TrimEnd('\').TrimEnd('/')
$ExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'
$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SubtitleBridge'
$ShortcutPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Subtitle Bridge.lnk'

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
