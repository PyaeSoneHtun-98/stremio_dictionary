param(
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\Subtitle Bridge",
  [switch]$NoShortcut,
  [switch]$NoLaunch,
  [string]$RuntimeManifestPath,
  [string]$RuntimeCacheDir,
  [switch]$SkipRuntimeProvisioning
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  return [System.IO.Path]::GetFullPath($Path).TrimEnd('\').TrimEnd('/')
}

function Test-IsSameOrChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Parent
  )

  $candidatePath = Get-NormalizedPath $Candidate
  $parentPath = Get-NormalizedPath $Parent

  if ($candidatePath.Equals($parentPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  return $candidatePath.StartsWith(
    "$parentPath\",
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

function Test-InstalledAppRunning {
  param([Parameter(Mandatory = $true)][string]$ExecutablePath)

  if (-not (Test-Path -LiteralPath $ExecutablePath)) {
    return $false
  }

  $targetPath = Get-NormalizedPath $ExecutablePath

  try {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'Subtitle Bridge.exe'" -ErrorAction Stop
    foreach ($process in $processes) {
      if (-not $process.ExecutablePath) {
        continue
      }

      $runningPath = Get-NormalizedPath $process.ExecutablePath
      if ($runningPath.Equals($targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
      }
    }
  } catch {
    try {
      $processes = Get-Process -Name 'Subtitle Bridge' -ErrorAction SilentlyContinue
      foreach ($process in $processes) {
        if (-not $process.MainModule -or -not $process.MainModule.FileName) {
          continue
        }

        $runningPath = Get-NormalizedPath $process.MainModule.FileName
        if ($runningPath.Equals($targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
          return $true
        }
      }
    } catch {
      # The same-volume directory swap below still fails safely if Windows keeps a runtime file locked.
    }
  }

  return $false
}

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Get-NormalizedPath (Resolve-Path $SourceDir).Path
$InstallDir = Get-NormalizedPath $InstallDir

if ([string]::IsNullOrWhiteSpace($RuntimeManifestPath)) {
  $RuntimeManifestPath = Join-Path $SourceDir 'RUNTIME_MANIFEST.json'
} else {
  $RuntimeManifestPath = Get-NormalizedPath $RuntimeManifestPath
}

if (-not [string]::IsNullOrWhiteSpace($RuntimeCacheDir)) {
  $RuntimeCacheDir = Get-NormalizedPath $RuntimeCacheDir
}

if (Test-IsSameOrChildPath -Candidate $InstallDir -Parent $SourceDir) {
  throw 'Choose an install directory outside the extracted package directory.'
}

if (Test-IsSameOrChildPath -Candidate $SourceDir -Parent $InstallDir) {
  throw 'The extracted package directory cannot be inside the install directory.'
}

$InstallParent = Split-Path -Parent $InstallDir
if ([string]::IsNullOrWhiteSpace($InstallParent)) {
  throw 'The install directory must have a parent directory.'
}

New-Item -ItemType Directory -Path $InstallParent -Force | Out-Null

$ExistingExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'
if (Test-InstalledAppRunning -ExecutablePath $ExistingExePath) {
  throw 'Subtitle Bridge is currently running from the install directory. Close it before upgrading.'
}

$transactionId = [System.Guid]::NewGuid().ToString('N')
$StageDir = Join-Path $InstallParent ".SubtitleBridge-stage-$transactionId"
$BackupDir = Join-Path $InstallParent ".SubtitleBridge-backup-$transactionId"

Write-Host "Installing Subtitle Bridge to $InstallDir"

try {
  New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

  Get-ChildItem -LiteralPath $SourceDir -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $StageDir -Recurse -Force
  }

  if (-not $SkipRuntimeProvisioning) {
    $runtimeInstaller = Join-Path $SourceDir 'Install-RuntimeTools.ps1'
    if (-not (Test-Path -LiteralPath $runtimeInstaller -PathType Leaf)) {
      throw 'The runtime provisioning helper is missing from this package.'
    }

    $runtimeParameters = @{
      DestinationRoot = (Join-Path $StageDir 'resources\tools')
      ManifestPath = $RuntimeManifestPath
    }
    if (-not [string]::IsNullOrWhiteSpace($RuntimeCacheDir)) {
      $runtimeParameters['CacheDir'] = $RuntimeCacheDir
    }

    & $runtimeInstaller @runtimeParameters
  }

  $requiredRelativePaths = @(
    'Subtitle Bridge.exe',
    'resources\app\package.json',
    'resources\app\out\main\index.js',
    'resources\app\out\preload\index.js',
    'resources\app\out\renderer\index.html'
  )

  if (-not $SkipRuntimeProvisioning) {
    $requiredRelativePaths += @(
      'resources\tools\mpv\mpv.exe',
      'resources\tools\ffmpeg\ffmpeg.exe'
    )
  }

  foreach ($relativePath in $requiredRelativePaths) {
    $stagedPath = Join-Path $StageDir $relativePath
    if (-not (Test-Path -LiteralPath $stagedPath)) {
      throw "The staged package is incomplete: $relativePath"
    }
  }

  $oldInstallMoved = $false
  $newInstallMoved = $false

  try {
    if (Test-Path -LiteralPath $InstallDir) {
      Move-Item -LiteralPath $InstallDir -Destination $BackupDir
      $oldInstallMoved = $true
    }

    Move-Item -LiteralPath $StageDir -Destination $InstallDir
    $newInstallMoved = $true
  } catch {
    $swapError = $_

    if ($newInstallMoved -and (Test-Path -LiteralPath $InstallDir)) {
      Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($oldInstallMoved -and (Test-Path -LiteralPath $BackupDir) -and -not (Test-Path -LiteralPath $InstallDir)) {
      Move-Item -LiteralPath $BackupDir -Destination $InstallDir -ErrorAction SilentlyContinue
    }

    throw $swapError
  }

  if (Test-Path -LiteralPath $BackupDir) {
    Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
  }
} catch {
  if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  throw
}

$ExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'
if (-not (Test-Path -LiteralPath $ExePath)) {
  throw 'Subtitle Bridge.exe was not found after installation.'
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

$AppPackageJsonPath = Join-Path $InstallDir 'resources\app\package.json'
$AppPackageJson = Get-Content -LiteralPath $AppPackageJsonPath -Raw | ConvertFrom-Json
$UninstallerPath = Join-Path $InstallDir 'Uninstall-SubtitleBridge.ps1'
if (-not (Test-Path -LiteralPath $UninstallerPath -PathType Leaf)) {
  throw 'The installed package is missing Uninstall-SubtitleBridge.ps1.'
}

$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SubtitleBridge'
New-Item -Path $UninstallRegistryPath -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayName' -Value 'Subtitle Bridge' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayVersion' -Value ([string]$AppPackageJson.version) -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'Publisher' -Value 'Subtitle Bridge' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'InstallLocation' -Value $InstallDir -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayIcon' -Value "$ExePath,0" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'UninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UninstallerPath`"" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'QuietUninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UninstallerPath`" -Quiet" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $UninstallRegistryPath -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

Write-Host 'Subtitle Bridge installation completed.'

if (-not $NoLaunch) {
  Start-Process -FilePath $ExePath
}
