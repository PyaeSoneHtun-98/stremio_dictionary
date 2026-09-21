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

function Get-PathToken {
  param([Parameter(Mandatory = $true)][string]$Path)

  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Path.ToLowerInvariant())
    $hash = $sha256.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').Substring(0, 16).ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Save-ShellMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$MetadataDir,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath
  )

  New-Item -ItemType Directory -Path $MetadataDir -Force | Out-Null

  if (Test-Path -LiteralPath $ShortcutPath -PathType Leaf) {
    Copy-Item -LiteralPath $ShortcutPath -Destination (Join-Path $MetadataDir 'Subtitle Bridge.lnk') -Force
  }

  $snapshot = [ordered]@{
    exists = $false
    values = [ordered]@{}
  }

  if (Test-Path -LiteralPath $RegistryPath) {
    $snapshot.exists = $true
    $properties = Get-ItemProperty -LiteralPath $RegistryPath
    foreach ($name in @(
      'DisplayName',
      'DisplayVersion',
      'Publisher',
      'InstallLocation',
      'DisplayIcon',
      'UninstallString',
      'QuietUninstallString',
      'RuntimeCacheDir',
      'NoModify',
      'NoRepair'
    )) {
      if ($properties.PSObject.Properties.Name -contains $name) {
        $snapshot.values[$name] = $properties.$name
      }
    }
  }

  $snapshot |
    ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath (Join-Path $MetadataDir 'uninstall-registry.json') -Encoding UTF8
}

function Restore-ShellMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$MetadataDir,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath
  )

  Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $RegistryPath -Recurse -Force -ErrorAction SilentlyContinue

  $shortcutBackup = Join-Path $MetadataDir 'Subtitle Bridge.lnk'
  if (Test-Path -LiteralPath $shortcutBackup -PathType Leaf) {
    $shortcutParent = Split-Path -Parent $ShortcutPath
    New-Item -ItemType Directory -Path $shortcutParent -Force | Out-Null
    Copy-Item -LiteralPath $shortcutBackup -Destination $ShortcutPath -Force
  }

  $registrySnapshotPath = Join-Path $MetadataDir 'uninstall-registry.json'
  if (-not (Test-Path -LiteralPath $registrySnapshotPath -PathType Leaf)) {
    return
  }

  $snapshot = Get-Content -LiteralPath $registrySnapshotPath -Raw | ConvertFrom-Json
  if (-not $snapshot.exists) {
    return
  }

  New-Item -Path $RegistryPath -Force | Out-Null
  foreach ($property in $snapshot.values.PSObject.Properties) {
    $propertyType = if ($property.Name -in @('NoModify', 'NoRepair')) { 'DWord' } else { 'String' }
    New-ItemProperty -Path $RegistryPath -Name $property.Name -Value $property.Value -PropertyType $propertyType -Force | Out-Null
  }
}

function Write-TransactionMarker {
  param(
    [Parameter(Mandatory = $true)][string]$MarkerPath,
    [Parameter(Mandatory = $true)][hashtable]$Data
  )

  $tempPath = "$MarkerPath.tmp"
  try {
    $json = $Data | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText(
      $tempPath,
      $json,
      [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $tempPath -Destination $MarkerPath -Force
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Recover-InterruptedTransaction {
  param(
    [Parameter(Mandatory = $true)][string]$MarkerPath,
    [Parameter(Mandatory = $true)][string]$ExpectedInstallDir,
    [Parameter(Mandatory = $true)][string]$InstallParent,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath
  )

  if (-not (Test-Path -LiteralPath $MarkerPath -PathType Leaf)) {
    return
  }

  try {
    $transaction = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
  } catch {
    throw 'A previous Subtitle Bridge installation transaction could not be recovered safely.'
  }

  if ($transaction.version -ne 1) {
    throw 'A previous Subtitle Bridge installation transaction uses an unsupported format.'
  }

  $markerInstallDir = Get-NormalizedPath ([string]$transaction.installDir)
  if (-not $markerInstallDir.Equals($ExpectedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'A previous Subtitle Bridge installation transaction targets a different install directory.'
  }

  $stageDir = Get-NormalizedPath ([string]$transaction.stageDir)
  $backupDir = Get-NormalizedPath ([string]$transaction.backupDir)
  $metadataDir = Get-NormalizedPath ([string]$transaction.metadataDir)

  foreach ($path in @($stageDir, $backupDir, $metadataDir)) {
    if (-not (Test-IsSameOrChildPath -Candidate $path -Parent $InstallParent)) {
      throw 'A previous Subtitle Bridge installation transaction contains an unsafe recovery path.'
    }
  }

  if (Test-Path -LiteralPath $backupDir -PathType Container) {
    if (Test-Path -LiteralPath $ExpectedInstallDir) {
      Remove-Item -LiteralPath $ExpectedInstallDir -Recurse -Force
    }

    Move-Item -LiteralPath $backupDir -Destination $ExpectedInstallDir
    Restore-ShellMetadata -MetadataDir $metadataDir -ShortcutPath $ShortcutPath -RegistryPath $RegistryPath
    Write-Host 'Recovered the previous Subtitle Bridge installation after an interrupted upgrade.'
  }

  Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $metadataDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction SilentlyContinue
}

function Restore-PreviousInstallation {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$BackupDir,
    [Parameter(Mandatory = $true)][string]$MetadataDir,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath
  )

  if (Test-Path -LiteralPath $InstallDir) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $BackupDir -PathType Container) {
    Move-Item -LiteralPath $BackupDir -Destination $InstallDir -ErrorAction SilentlyContinue
  }

  Restore-ShellMetadata -MetadataDir $MetadataDir -ShortcutPath $ShortcutPath -RegistryPath $RegistryPath
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

} catch {
  if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  throw
}

$ExePath = Join-Path $InstallDir 'Subtitle Bridge.exe'

try {
  if (-not (Test-Path -LiteralPath $ExePath)) {
    throw 'Subtitle Bridge.exe was not found after installation.'
  }

  # CI uses this fail-after-swap hook to prove that post-install metadata failures restore
  # the previously working installation. If a user sets it, failing closed is safe.
  if ($env:SUBTITLE_BRIDGE_TEST_FORCE_POST_INSTALL_FAILURE -eq '1') {
    throw 'Simulated post-install metadata failure.'
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
} catch {
  $postInstallError = $_

  Remove-Item -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Subtitle Bridge.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SubtitleBridge' -Recurse -Force -ErrorAction SilentlyContinue

  if ($newInstallMoved -and (Test-Path -LiteralPath $InstallDir)) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  if ($oldInstallMoved -and (Test-Path -LiteralPath $BackupDir) -and -not (Test-Path -LiteralPath $InstallDir)) {
    Move-Item -LiteralPath $BackupDir -Destination $InstallDir -ErrorAction SilentlyContinue
  }

  throw $postInstallError
}

if (Test-Path -LiteralPath $BackupDir) {
  Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not $NoLaunch) {
  Start-Process -FilePath $ExePath
}
