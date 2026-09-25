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

function Test-ExpectedInstallLayout {
  param([Parameter(Mandatory = $true)][string]$Directory)

  $requiredPaths = @(
    'Subtitle Bridge.exe',
    'resources\app\package.json',
    'resources\app\out\main\index.js',
    'resources\app\out\preload\index.js',
    'resources\app\out\renderer\index.html'
  )

  foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $Directory $relativePath))) {
      return $false
    }
  }

  try {
    $packageJson = Get-Content -LiteralPath (Join-Path $Directory 'resources\app\package.json') -Raw | ConvertFrom-Json
    return ([string]$packageJson.name -eq 'subtitle-bridge')
  } catch {
    return $false
  }
}

function Write-InstallOwnershipMarker {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir
  )

  $markerPath = Join-Path $Directory '.subtitle-bridge-install.json'
  [ordered]@{
    version = 1
    application = 'Subtitle Bridge'
    installDir = (Get-NormalizedPath $LogicalInstallDir)
  } |
    ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $markerPath -Encoding UTF8
}

function Assert-OwnedInstallDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir,
    [switch]$AllowLegacyDefault
  )

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }

  $entries = @(Get-ChildItem -LiteralPath $Directory -Force -ErrorAction Stop)
  if ($entries.Count -eq 0) {
    return
  }

  if (-not (Test-ExpectedInstallLayout -Directory $Directory)) {
    throw "The existing install directory is not a recognized Subtitle Bridge installation: $Directory"
  }

  $markerPath = Join-Path $Directory '.subtitle-bridge-install.json'
  if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
    try {
      $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    } catch {
      throw "The Subtitle Bridge ownership marker is unreadable: $markerPath"
    }

    $expected = Get-NormalizedPath $LogicalInstallDir
    $recorded = Get-NormalizedPath ([string]$marker.installDir)
    if ($marker.version -ne 1 -or
        [string]$marker.application -ne 'Subtitle Bridge' -or
        -not $recorded.Equals($expected, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "The existing install directory has an invalid Subtitle Bridge ownership marker: $Directory"
    }
    return
  }

  $defaultInstallDir = Get-NormalizedPath (Join-Path $env:LOCALAPPDATA 'Programs\Subtitle Bridge')
  $logical = Get-NormalizedPath $LogicalInstallDir
  if ($AllowLegacyDefault -and
      $logical.Equals($defaultInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-InstallOwnershipMarker -Directory $Directory -LogicalInstallDir $LogicalInstallDir
    Write-Host 'Migrated the previous default Subtitle Bridge installation to the ownership-marker format.'
    return
  }

  throw "Refusing to replace a non-empty directory without a Subtitle Bridge ownership marker: $Directory"
}

function Get-ProcessPathState {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    $candidate = [System.Diagnostics.Process]::GetProcessById($ProcessId)
  } catch [System.ArgumentException] {
    return [pscustomobject]@{
      exists = $false
      accessible = $true
      path = $null
    }
  }

  try {
    try {
      $fileName = $candidate.MainModule.FileName
    } catch [System.ComponentModel.Win32Exception] {
      return [pscustomobject]@{
        exists = $true
        accessible = $false
        path = $null
      }
    } catch [System.InvalidOperationException] {
      return [pscustomobject]@{
        exists = $false
        accessible = $true
        path = $null
      }
    }

    if ([string]::IsNullOrWhiteSpace($fileName)) {
      return [pscustomobject]@{
        exists = $true
        accessible = $false
        path = $null
      }
    }

    return [pscustomobject]@{
      exists = $true
      accessible = $true
      path = (Get-NormalizedPath $fileName)
    }
  } finally {
    $candidate.Dispose()
  }
}

function Test-InstalledAppRunning {
  param([Parameter(Mandatory = $true)][string]$ExecutablePath)

  if (-not (Test-Path -LiteralPath $ExecutablePath)) {
    return $false
  }

  $targetPath = Get-NormalizedPath $ExecutablePath
  $cimFailed = $false

  try {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'Subtitle Bridge.exe'" -ErrorAction Stop
  } catch {
    $cimFailed = $true
    $processes = @()
  }

  if (-not $cimFailed) {
    foreach ($process in $processes) {
      $runningPath = [string]$process.ExecutablePath
      if ($env:SUBTITLE_BRIDGE_TEST_FORCE_CIM_PATH_MISSING -eq '1') {
        $runningPath = $null
      }

      if ([string]::IsNullOrWhiteSpace($runningPath)) {
        $pathState = Get-ProcessPathState -ProcessId ([int]$process.ProcessId)
        if (-not $pathState.exists) {
          continue
        }
        if (-not $pathState.accessible) {
          throw 'A running Subtitle Bridge.exe process could not be inspected. Close all Subtitle Bridge processes and retry setup.'
        }

        $runningPath = [string]$pathState.path
      } else {
        $runningPath = Get-NormalizedPath $runningPath
      }

      if ($runningPath.Equals($targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
      }
    }

    return $false
  }

  $fallbackProcesses = Get-Process -Name 'Subtitle Bridge' -ErrorAction SilentlyContinue
  foreach ($process in $fallbackProcesses) {
    $pathState = Get-ProcessPathState -ProcessId ([int]$process.Id)
    if (-not $pathState.exists) {
      continue
    }
    if (-not $pathState.accessible) {
      throw 'A running Subtitle Bridge.exe process could not be inspected. Close all Subtitle Bridge processes and retry setup.'
    }

    if ([string]$pathState.path -and
        ([string]$pathState.path).Equals($targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  return $false
}

function Wait-ForMatchingProcessExit {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$ExpectedExecutablePath,
    [Parameter(Mandatory = $true)][long]$ExpectedStartedAtUnixMs,
    [int]$TimeoutMilliseconds = 30000
  )

  if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
    throw 'The updater parent process ID is invalid.'
  }

  try {
    $process = [System.Diagnostics.Process]::GetProcessById($ProcessId)
  } catch [System.ArgumentException] {
    return
  }

  try {
    try {
      $actualExecutablePath = Get-NormalizedPath $process.MainModule.FileName
      $actualStartedAtUnixMs = [System.DateTimeOffset]::new(
        $process.StartTime.ToUniversalTime()
      ).ToUnixTimeMilliseconds()
    } catch [System.ComponentModel.Win32Exception] {
      # The PID exists, but its identity cannot be verified. Do not wait on an arbitrary
      # recycled/inaccessible process; the installed-app check below remains authoritative.
      return
    } catch [System.InvalidOperationException] {
      # The original process exited while setup was checking its identity.
      return
    }

    $expectedPath = Get-NormalizedPath $ExpectedExecutablePath
    if (-not $actualExecutablePath.Equals(
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
      )) {
      return
    }

    # Node's performance.timeOrigin is captured during startup and can be slightly later than
    # the Win32 process creation timestamp. Five seconds safely covers that initialization
    # skew while still distinguishing a recycled process. If the same executable is relaunched
    # inside that tiny window, waiting for it is also safe because it would lock this install.
    if ([Math]::Abs($actualStartedAtUnixMs - $ExpectedStartedAtUnixMs) -gt 5000) {
      return
    }

    if (-not $process.WaitForExit($TimeoutMilliseconds)) {
      throw 'Timed out waiting for the running Subtitle Bridge process to exit before upgrading.'
    }
  } finally {
    $process.Dispose()
  }
}

function Wait-ForInstalledAppShutdown {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [int]$TimeoutMilliseconds = 10000
  )

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  while (Test-InstalledAppRunning -ExecutablePath $ExecutablePath) {
    if ($stopwatch.ElapsedMilliseconds -ge $TimeoutMilliseconds) {
      throw 'Subtitle Bridge did not finish shutting down before the upgrade timeout.'
    }

    Start-Sleep -Milliseconds 100
  }
}

function Move-DirectoryWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [int]$MaxAttempts = 24,
    [int]$DelayMilliseconds = 250
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    try {
      # Source and destination are sibling paths under the same install parent.
      # Directory.Move performs a rename rather than PowerShell's potentially
      # recursive Move-Item behavior, so a lock failure cannot leave a partial backup.
      [System.IO.Directory]::Move($Source, $Destination)
      return
    } catch {
      $moveError = $_

      # A transient lock must leave the source intact and destination absent. If either
      # invariant is false, do not retry because transaction state may have changed.
      if ((Test-Path -LiteralPath $Destination) -or
          -not (Test-Path -LiteralPath $Source -PathType Container) -or
          $attempt -ge $MaxAttempts) {
        throw $moveError
      }

      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }
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

function Acquire-InstallMutex {
  param([Parameter(Mandatory = $true)][string]$InstallPathToken)

  $mutexName = "Local\SubtitleBridge-Setup-$InstallPathToken"
  $mutex = New-Object System.Threading.Mutex($false, $mutexName)
  $acquired = $false

  try {
    try {
      $acquired = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
      # The previous setup process terminated while holding the mutex. Windows transfers
      # ownership to this process, and transaction recovery below will repair its state.
      $acquired = $true
    }

    if (-not $acquired) {
      throw 'Another Subtitle Bridge setup is already running for this install directory. Finish or close it before starting setup again.'
    }

    return $mutex
  } catch {
    $mutex.Dispose()
    throw
  }
}

function Save-ShellMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$MetadataDir,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath,
    [Parameter(Mandatory = $true)][string]$TransactionId,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir
  )

  New-Item -ItemType Directory -Path $MetadataDir -Force | Out-Null
  Write-TransactionDirectoryMarker -Directory $MetadataDir -TransactionId $TransactionId -Role 'metadata' -LogicalInstallDir $LogicalInstallDir

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
    foreach ($property in $properties.PSObject.Properties) {
      if ($property.Name -notlike 'PS*') {
        $snapshot.values[$property.Name] = $property.Value
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

  if ($env:SUBTITLE_BRIDGE_TEST_FORCE_SHELL_METADATA_FAILURE -eq '1') {
    throw 'Simulated shell metadata restoration failure.'
  }

  $shortcutBackup = Join-Path $MetadataDir 'Subtitle Bridge.lnk'
  $registrySnapshotPath = Join-Path $MetadataDir 'uninstall-registry.json'
  if (-not (Test-Path -LiteralPath $registrySnapshotPath -PathType Leaf)) {
    throw 'The saved uninstall-registry snapshot is missing; rollback cannot be verified.'
  }

  $snapshot = Get-Content -LiteralPath $registrySnapshotPath -Raw | ConvertFrom-Json

  if (Test-Path -LiteralPath $ShortcutPath) {
    Remove-Item -LiteralPath $ShortcutPath -Force -ErrorAction Stop
  }
  if (Test-Path -LiteralPath $ShortcutPath) {
    throw 'Could not remove the current Subtitle Bridge Start Menu shortcut during rollback.'
  }

  if (Test-Path -LiteralPath $RegistryPath) {
    Remove-Item -LiteralPath $RegistryPath -Recurse -Force -ErrorAction Stop
  }
  if (Test-Path -LiteralPath $RegistryPath) {
    throw 'Could not remove the current Subtitle Bridge uninstall registry metadata during rollback.'
  }

  if (Test-Path -LiteralPath $shortcutBackup -PathType Leaf) {
    $shortcutParent = Split-Path -Parent $ShortcutPath
    New-Item -ItemType Directory -Path $shortcutParent -Force | Out-Null
    Copy-Item -LiteralPath $shortcutBackup -Destination $ShortcutPath -Force
    if (-not (Test-Path -LiteralPath $ShortcutPath -PathType Leaf)) {
      throw 'Could not restore the previous Subtitle Bridge Start Menu shortcut.'
    }
  }

  if ($snapshot.exists) {
    New-Item -Path $RegistryPath -Force | Out-Null
    foreach ($property in $snapshot.values.PSObject.Properties) {
      $propertyType = if ($property.Name -in @('NoModify', 'NoRepair')) { 'DWord' } else { 'String' }
      New-ItemProperty -Path $RegistryPath -Name $property.Name -Value $property.Value -PropertyType $propertyType -Force | Out-Null
    }

    if (-not (Test-Path -LiteralPath $RegistryPath)) {
      throw 'Could not restore the previous Subtitle Bridge uninstall registry key.'
    }

    $restored = Get-ItemProperty -LiteralPath $RegistryPath
    foreach ($property in $snapshot.values.PSObject.Properties) {
      $actual = $restored.PSObject.Properties[$property.Name]
      if ($null -eq $actual -or [string]$actual.Value -ne [string]$property.Value) {
        throw "Could not verify restored uninstall registry value: $($property.Name)"
      }
    }
  } elseif (Test-Path -LiteralPath $RegistryPath) {
    throw 'Rollback expected no uninstall registry metadata, but the key still exists.'
  }
}

function Write-TransactionDirectoryMarker {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$TransactionId,
    [Parameter(Mandatory = $true)][ValidateSet('stage', 'metadata')][string]$Role,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir
  )

  $markerPath = Join-Path $Directory ".subtitle-bridge-transaction-$Role.json"
  [ordered]@{
    version = 1
    application = 'Subtitle Bridge'
    transactionId = $TransactionId
    role = $Role
    installDir = (Get-NormalizedPath $LogicalInstallDir)
  } |
    ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $markerPath -Encoding UTF8
}

function Assert-TransactionDirectoryMarker {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$TransactionId,
    [Parameter(Mandatory = $true)][ValidateSet('stage', 'metadata')][string]$Role,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir
  )

  $markerPath = Join-Path $Directory ".subtitle-bridge-transaction-$Role.json"
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "Refusing to recursively remove an unowned transaction $Role directory: $Directory"
  }

  try {
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
  } catch {
    throw "The transaction $Role ownership marker is unreadable: $markerPath"
  }

  $expectedInstallDir = Get-NormalizedPath $LogicalInstallDir
  $recordedInstallDir = Get-NormalizedPath ([string]$marker.installDir)
  if ($marker.version -ne 1 -or
      [string]$marker.application -ne 'Subtitle Bridge' -or
      [string]$marker.transactionId -ne $TransactionId -or
      [string]$marker.role -ne $Role -or
      -not $recordedInstallDir.Equals($expectedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The transaction $Role ownership marker does not match this installation transaction."
  }
}

function Assert-TransactionPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$InstallParent,
    [Parameter(Mandatory = $true)][string]$ExpectedLeafName,
    [Parameter(Mandatory = $true)][string]$InstallDir
  )

  $normalized = Get-NormalizedPath $Path
  $parent = Get-NormalizedPath (Split-Path -Parent $normalized)
  $expectedParent = Get-NormalizedPath $InstallParent
  $leaf = Split-Path -Leaf $normalized
  $normalizedInstallDir = Get-NormalizedPath $InstallDir

  if (-not $parent.Equals($expectedParent, [System.StringComparison]::OrdinalIgnoreCase) -or
      -not $leaf.Equals($ExpectedLeafName, [System.StringComparison]::Ordinal) -or
      $normalized.Equals($expectedParent, [System.StringComparison]::OrdinalIgnoreCase) -or
      $normalized.Equals($normalizedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'A previous Subtitle Bridge installation transaction contains an unsafe temporary path.'
  }

  return $normalized
}

function Write-TransactionMarker {
  param(
    [Parameter(Mandatory = $true)][string]$MarkerPath,
    [Parameter(Mandatory = $true)]$Data
  )

  $tempPath = "$MarkerPath.tmp"
  try {
    $json = $Data | ConvertTo-Json -Depth 6
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

function Set-TransactionPhase {
  param(
    [Parameter(Mandatory = $true)][string]$MarkerPath,
    [Parameter(Mandatory = $true)][string]$Phase
  )

  $transaction = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
  $transaction.phase = $Phase
  Write-TransactionMarker -MarkerPath $MarkerPath -Data $transaction
}

function Remove-OwnedTransactionDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][string]$TransactionId,
    [Parameter(Mandatory = $true)][ValidateSet('stage', 'metadata')][string]$Role,
    [Parameter(Mandatory = $true)][string]$LogicalInstallDir
  )

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }

  Assert-TransactionDirectoryMarker -Directory $Directory -TransactionId $TransactionId -Role $Role -LogicalInstallDir $LogicalInstallDir
  Remove-Item -LiteralPath $Directory -Recurse -Force -ErrorAction Stop
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

  if ($transaction.version -ne 2) {
    throw 'A previous Subtitle Bridge installation transaction uses an unsupported format.'
  }

  $transactionId = [string]$transaction.transactionId
  if ($transactionId -notmatch '^[0-9a-f]{32}$') {
    throw 'A previous Subtitle Bridge installation transaction has an invalid transaction identifier.'
  }

  $markerInstallDir = Get-NormalizedPath ([string]$transaction.installDir)
  if (-not $markerInstallDir.Equals($ExpectedInstallDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'A previous Subtitle Bridge installation transaction targets a different install directory.'
  }

  $stageDir = Assert-TransactionPath -Path ([string]$transaction.stageDir) -InstallParent $InstallParent -ExpectedLeafName ".SubtitleBridge-stage-$transactionId" -InstallDir $ExpectedInstallDir
  $backupDir = Assert-TransactionPath -Path ([string]$transaction.backupDir) -InstallParent $InstallParent -ExpectedLeafName ".SubtitleBridge-backup-$transactionId" -InstallDir $ExpectedInstallDir
  $metadataDir = Assert-TransactionPath -Path ([string]$transaction.metadataDir) -InstallParent $InstallParent -ExpectedLeafName ".SubtitleBridge-metadata-$transactionId" -InstallDir $ExpectedInstallDir

  if ($stageDir.Equals($backupDir, [System.StringComparison]::OrdinalIgnoreCase) -or
      $stageDir.Equals($metadataDir, [System.StringComparison]::OrdinalIgnoreCase) -or
      $backupDir.Equals($metadataDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'A previous Subtitle Bridge installation transaction reuses a temporary path.'
  }

  $hadPreviousInstall = [bool]$transaction.hadPreviousInstall
  $phase = [string]$transaction.phase
  $validPhases = @('prepared', 'backup-moved', 'new-installed', 'restoring-app', 'app-restored', 'app-removed', 'metadata-restored', 'committed')
  if ($phase -notin $validPhases) {
    throw 'A previous Subtitle Bridge installation transaction has an invalid recovery phase.'
  }

  $backupExists = Test-Path -LiteralPath $backupDir -PathType Container
  if ($backupExists) {
    Assert-OwnedInstallDirectory -Directory $backupDir -LogicalInstallDir $ExpectedInstallDir
  }

  if ($phase -eq 'committed') {
    # The new application and shell metadata are already authoritative. A crash during
    # successful cleanup must never turn the next setup run into a rollback.
    if ($backupExists) {
      Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction Stop
    }

    if (Test-Path -LiteralPath $metadataDir -PathType Container) {
      Remove-OwnedTransactionDirectory -Directory $metadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $ExpectedInstallDir
    }

    if (Test-Path -LiteralPath $stageDir -PathType Container) {
      Remove-OwnedTransactionDirectory -Directory $stageDir -TransactionId $transactionId -Role 'stage' -LogicalInstallDir $ExpectedInstallDir
    }

    Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction Stop
    Write-Host 'Finished cleanup from a previously committed Subtitle Bridge installation.'
    return
  }

  if (-not (Test-Path -LiteralPath $metadataDir -PathType Container)) {
    throw 'A previous Subtitle Bridge installation transaction is missing its shell-metadata snapshot.'
  }
  Assert-TransactionDirectoryMarker -Directory $metadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $ExpectedInstallDir

  if ($phase -in @('backup-moved', 'new-installed', 'restoring-app') -or $backupExists) {
    Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'restoring-app'

    if ($hadPreviousInstall) {
      if ($backupExists) {
        if (Test-Path -LiteralPath $ExpectedInstallDir) {
          Assert-OwnedInstallDirectory -Directory $ExpectedInstallDir -LogicalInstallDir $ExpectedInstallDir
          Remove-Item -LiteralPath $ExpectedInstallDir -Recurse -Force -ErrorAction Stop
        }
        Move-Item -LiteralPath $backupDir -Destination $ExpectedInstallDir -ErrorAction Stop
      } elseif (-not (Test-Path -LiteralPath $ExpectedInstallDir -PathType Container)) {
        throw 'The previous installation backup is missing and the restored application is not present.'
      }

      Assert-OwnedInstallDirectory -Directory $ExpectedInstallDir -LogicalInstallDir $ExpectedInstallDir
      Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'app-restored'
    } else {
      if (Test-Path -LiteralPath $ExpectedInstallDir) {
        Assert-OwnedInstallDirectory -Directory $ExpectedInstallDir -LogicalInstallDir $ExpectedInstallDir
        Remove-Item -LiteralPath $ExpectedInstallDir -Recurse -Force -ErrorAction Stop
      }
      Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'app-removed'
    }
  }

  $transaction = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
  $phase = [string]$transaction.phase
  if ($phase -in @('app-restored', 'app-removed', 'restoring-app')) {
    Restore-ShellMetadata -MetadataDir $metadataDir -ShortcutPath $ShortcutPath -RegistryPath $RegistryPath
    Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'metadata-restored'
  } elseif ($phase -eq 'prepared') {
    # The existing app and shell metadata were never swapped. Only owned temporary data needs cleanup.
  } elseif ($phase -ne 'metadata-restored') {
    throw 'A previous Subtitle Bridge installation transaction could not determine a safe recovery action.'
  }

  Remove-OwnedTransactionDirectory -Directory $stageDir -TransactionId $transactionId -Role 'stage' -LogicalInstallDir $ExpectedInstallDir
  Remove-OwnedTransactionDirectory -Directory $metadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $ExpectedInstallDir

  if (Test-Path -LiteralPath $backupDir -PathType Container) {
    Assert-OwnedInstallDirectory -Directory $backupDir -LogicalInstallDir $ExpectedInstallDir
    Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction Stop
  }

  Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction Stop
  Write-Host 'Recovered the previous Subtitle Bridge installation after an interrupted or failed upgrade.'
}

function Restore-PreviousInstallation {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$BackupDir,
    [Parameter(Mandatory = $true)][string]$MetadataDir,
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$RegistryPath,
    [Parameter(Mandatory = $true)][string]$MarkerPath,
    [Parameter(Mandatory = $true)][bool]$HadPreviousInstall
  )

  if ($env:SUBTITLE_BRIDGE_TEST_FORCE_ROLLBACK_FAILURE -eq '1') {
    throw 'Simulated rollback restoration failure.'
  }

  Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'restoring-app'

  if ($HadPreviousInstall) {
    if (Test-Path -LiteralPath $BackupDir -PathType Container) {
      Assert-OwnedInstallDirectory -Directory $BackupDir -LogicalInstallDir $InstallDir

      if (Test-Path -LiteralPath $InstallDir) {
        Assert-OwnedInstallDirectory -Directory $InstallDir -LogicalInstallDir $InstallDir
        Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction Stop
      }

      Move-Item -LiteralPath $BackupDir -Destination $InstallDir -ErrorAction Stop
    } elseif (-not (Test-Path -LiteralPath $InstallDir -PathType Container)) {
      throw 'The previous Subtitle Bridge installation backup is missing; automatic rollback cannot continue.'
    }

    Assert-OwnedInstallDirectory -Directory $InstallDir -LogicalInstallDir $InstallDir
    Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'app-restored'
  } else {
    if (Test-Path -LiteralPath $InstallDir) {
      Assert-OwnedInstallDirectory -Directory $InstallDir -LogicalInstallDir $InstallDir
      Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction Stop
    }
    Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'app-removed'
  }

  Restore-ShellMetadata -MetadataDir $MetadataDir -ShortcutPath $ShortcutPath -RegistryPath $RegistryPath
  Set-TransactionPhase -MarkerPath $MarkerPath -Phase 'metadata-restored'
}

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Get-NormalizedPath (Resolve-Path $SourceDir).Path
$InstallDir = Get-NormalizedPath $InstallDir

if ([string]::IsNullOrWhiteSpace($RuntimeManifestPath)) {
  $RuntimeManifestPath = Join-Path $SourceDir 'RUNTIME_MANIFEST.json'
} else {
  $RuntimeManifestPath = Get-NormalizedPath $RuntimeManifestPath
}

if ([string]::IsNullOrWhiteSpace($RuntimeCacheDir)) {
  $RuntimeCacheDir = Get-NormalizedPath (Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\RuntimeCache')
} else {
  $RuntimeCacheDir = Get-NormalizedPath $RuntimeCacheDir
}

if ((Test-IsSameOrChildPath -Candidate $RuntimeCacheDir -Parent $InstallDir) -or
    (Test-IsSameOrChildPath -Candidate $InstallDir -Parent $RuntimeCacheDir)) {
  throw 'The managed runtime cache and application install directory must be separate locations.'
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
$UpdateParentPidRaw = $env:SUBTITLE_BRIDGE_UPDATE_PARENT_PID
$UpdateParentExeRaw = $env:SUBTITLE_BRIDGE_UPDATE_PARENT_EXE
$UpdateParentStartedAtRaw = $env:SUBTITLE_BRIDGE_UPDATE_PARENT_STARTED_AT_MS
$hasUpdateParentIdentity = (
  -not [string]::IsNullOrWhiteSpace($UpdateParentPidRaw) -or
  -not [string]::IsNullOrWhiteSpace($UpdateParentExeRaw) -or
  -not [string]::IsNullOrWhiteSpace($UpdateParentStartedAtRaw)
)

if ($hasUpdateParentIdentity) {
  if ([string]::IsNullOrWhiteSpace($UpdateParentPidRaw) -or
      [string]::IsNullOrWhiteSpace($UpdateParentExeRaw) -or
      [string]::IsNullOrWhiteSpace($UpdateParentStartedAtRaw)) {
    throw 'The updater parent process identity is incomplete.'
  }

  $updateParentPid = 0
  if (-not [int]::TryParse($UpdateParentPidRaw, [ref]$updateParentPid) -or $updateParentPid -le 0) {
    throw 'SUBTITLE_BRIDGE_UPDATE_PARENT_PID must contain a valid process ID.'
  }

  $updateParentStartedAtMs = [long]0
  if (-not [long]::TryParse($UpdateParentStartedAtRaw, [ref]$updateParentStartedAtMs) -or
      $updateParentStartedAtMs -le 0) {
    throw 'SUBTITLE_BRIDGE_UPDATE_PARENT_STARTED_AT_MS must contain a valid process start time.'
  }

  $updateParentExecutablePath = Get-NormalizedPath $UpdateParentExeRaw
  $normalizedExistingExePath = Get-NormalizedPath $ExistingExePath
  if (-not $updateParentExecutablePath.Equals(
      $normalizedExistingExePath,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
    throw 'The updater parent executable does not match the Subtitle Bridge install target.'
  }

  Wait-ForMatchingProcessExit `
    -ProcessId $updateParentPid `
    -ExpectedExecutablePath $updateParentExecutablePath `
    -ExpectedStartedAtUnixMs $updateParentStartedAtMs
}

# Older updater builds do not pass the full parent identity. Give any running installed
# process a bounded grace period to finish the shutdown that follows installer launch.
if (Test-InstalledAppRunning -ExecutablePath $ExistingExePath) {
  Wait-ForInstalledAppShutdown -ExecutablePath $ExistingExePath
}

if (Test-InstalledAppRunning -ExecutablePath $ExistingExePath) {
  throw 'Subtitle Bridge is still running from the install directory after the upgrade wait. Close it and retry.'
}

$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$ShortcutPath = Join-Path $StartMenuDir 'Subtitle Bridge.lnk'
$UninstallRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SubtitleBridge'
$InstallPathToken = Get-PathToken $InstallDir
$TransactionMarkerPath = Join-Path $InstallParent ('.SubtitleBridge-transaction-' + $InstallPathToken + '.json')
$InstallMutex = Acquire-InstallMutex -InstallPathToken $InstallPathToken
$InstallMutexHeld = $true

try {
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_TEST_INSTALL_LOCK_SIGNAL_PATH)) {
    $lockSignalPath = [System.IO.Path]::GetFullPath($env:SUBTITLE_BRIDGE_TEST_INSTALL_LOCK_SIGNAL_PATH)
    $lockSignalParent = Split-Path -Parent $lockSignalPath
    if (-not [string]::IsNullOrWhiteSpace($lockSignalParent)) {
      New-Item -ItemType Directory -Path $lockSignalParent -Force | Out-Null
    }
    Set-Content -LiteralPath $lockSignalPath -Value 'acquired' -Encoding ASCII
  }

  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_TEST_HOLD_INSTALL_LOCK_MS)) {
    $holdMilliseconds = 0
    if (-not [int]::TryParse($env:SUBTITLE_BRIDGE_TEST_HOLD_INSTALL_LOCK_MS, [ref]$holdMilliseconds) -or
        $holdMilliseconds -lt 0 -or $holdMilliseconds -gt 30000) {
      throw 'SUBTITLE_BRIDGE_TEST_HOLD_INSTALL_LOCK_MS must be an integer from 0 to 30000.'
    }
    Start-Sleep -Milliseconds $holdMilliseconds
  }

Assert-OwnedInstallDirectory -Directory $InstallDir -LogicalInstallDir $InstallDir -AllowLegacyDefault
Recover-InterruptedTransaction -MarkerPath $TransactionMarkerPath -ExpectedInstallDir $InstallDir -InstallParent $InstallParent -ShortcutPath $ShortcutPath -RegistryPath $UninstallRegistryPath

$transactionId = [System.Guid]::NewGuid().ToString('N')
$StageDir = Join-Path $InstallParent ".SubtitleBridge-stage-$transactionId"
$BackupDir = Join-Path $InstallParent ".SubtitleBridge-backup-$transactionId"
$MetadataDir = Join-Path $InstallParent ".SubtitleBridge-metadata-$transactionId"

$hadPreviousInstall = Test-Path -LiteralPath $InstallDir -PathType Container
if ($hadPreviousInstall) {
  $existingEntries = @(Get-ChildItem -LiteralPath $InstallDir -Force -ErrorAction Stop)
  if ($existingEntries.Count -eq 0) {
    Remove-Item -LiteralPath $InstallDir -Force -ErrorAction Stop
    $hadPreviousInstall = $false
  }
}

Save-ShellMetadata -MetadataDir $MetadataDir -ShortcutPath $ShortcutPath -RegistryPath $UninstallRegistryPath -TransactionId $transactionId -LogicalInstallDir $InstallDir
Write-TransactionMarker -MarkerPath $TransactionMarkerPath -Data ([ordered]@{
  version = 2
  transactionId = $transactionId
  phase = 'prepared'
  hadPreviousInstall = $hadPreviousInstall
  installDir = $InstallDir
  stageDir = $StageDir
  backupDir = $BackupDir
  metadataDir = $MetadataDir
})

Write-Host "Installing Subtitle Bridge to $InstallDir"

try {
  New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
  Write-TransactionDirectoryMarker -Directory $StageDir -TransactionId $transactionId -Role 'stage' -LogicalInstallDir $InstallDir

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
      CacheDir = $RuntimeCacheDir
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

  Write-InstallOwnershipMarker -Directory $StageDir -LogicalInstallDir $InstallDir
  Assert-OwnedInstallDirectory -Directory $StageDir -LogicalInstallDir $InstallDir

  try {
    if ($hadPreviousInstall) {
      Move-DirectoryWithRetry -Source $InstallDir -Destination $BackupDir
      Set-TransactionPhase -MarkerPath $TransactionMarkerPath -Phase 'backup-moved'

      if ($env:SUBTITLE_BRIDGE_TEST_FORCE_SWAP_TERMINATION -eq '1') {
        [System.Diagnostics.Process]::GetCurrentProcess().Kill()
        Start-Sleep -Seconds 30
      }
    }

    Move-Item -LiteralPath $StageDir -Destination $InstallDir -ErrorAction Stop
    Set-TransactionPhase -MarkerPath $TransactionMarkerPath -Phase 'new-installed'
    $installedStageMarker = Join-Path $InstallDir '.subtitle-bridge-transaction-stage.json'
    Remove-Item -LiteralPath $installedStageMarker -Force -ErrorAction SilentlyContinue
  } catch {
    $swapError = $_

    try {
      Restore-PreviousInstallation -InstallDir $InstallDir -BackupDir $BackupDir -MetadataDir $MetadataDir -ShortcutPath $ShortcutPath -RegistryPath $UninstallRegistryPath -MarkerPath $TransactionMarkerPath -HadPreviousInstall $hadPreviousInstall
      Remove-Item -LiteralPath $TransactionMarkerPath -Force -ErrorAction Stop
    } catch {
      throw "The upgrade failed and automatic rollback also failed. Recovery data was preserved for the next setup run. Upgrade error: $($swapError.Exception.Message) Rollback error: $($_.Exception.Message)"
    }

    throw $swapError
  }

} catch {
  $recoveryPending = $false
  if (Test-Path -LiteralPath $TransactionMarkerPath -PathType Leaf) {
    try {
      $failedTransaction = Get-Content -LiteralPath $TransactionMarkerPath -Raw | ConvertFrom-Json
      $recoveryPending = ([string]$failedTransaction.phase -ne 'prepared')
    } catch {
      # An unreadable transaction marker is evidence we must preserve for fail-closed recovery.
      $recoveryPending = $true
    }
  }

  if (-not $recoveryPending) {
    Remove-OwnedTransactionDirectory -Directory $StageDir -TransactionId $transactionId -Role 'stage' -LogicalInstallDir $InstallDir
    Remove-OwnedTransactionDirectory -Directory $MetadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $InstallDir
    Remove-Item -LiteralPath $TransactionMarkerPath -Force -ErrorAction SilentlyContinue
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
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
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

  New-Item -Path $UninstallRegistryPath -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayName' -Value 'Subtitle Bridge' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayVersion' -Value ([string]$AppPackageJson.version) -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'Publisher' -Value 'Subtitle Bridge' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'InstallLocation' -Value $InstallDir -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'DisplayIcon' -Value "$ExePath,0" -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'RuntimeCacheDir' -Value $RuntimeCacheDir -PropertyType String -Force | Out-Null
  $uninstallCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$UninstallerPath`" -InstallDir `"$InstallDir`""
  $quietUninstallCommand = "$uninstallCommand -Quiet"
  New-ItemProperty -Path $UninstallRegistryPath -Name 'UninstallString' -Value $uninstallCommand -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'QuietUninstallString' -Value $quietUninstallCommand -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty -Path $UninstallRegistryPath -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null

  Write-Host 'Subtitle Bridge installation completed.'
} catch {
  $postInstallError = $_

  try {
    Restore-PreviousInstallation -InstallDir $InstallDir -BackupDir $BackupDir -MetadataDir $MetadataDir -ShortcutPath $ShortcutPath -RegistryPath $UninstallRegistryPath -MarkerPath $TransactionMarkerPath -HadPreviousInstall $hadPreviousInstall
    Remove-OwnedTransactionDirectory -Directory $MetadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $InstallDir
    Remove-Item -LiteralPath $TransactionMarkerPath -Force -ErrorAction Stop
  } catch {
    throw "Post-install setup failed and automatic rollback also failed. Recovery data was preserved for the next setup run. Setup error: $($postInstallError.Exception.Message) Rollback error: $($_.Exception.Message)"
  }

  throw $postInstallError
}

Set-TransactionPhase -MarkerPath $TransactionMarkerPath -Phase 'committed'

if ($env:SUBTITLE_BRIDGE_TEST_COMMITTED_CLEANUP_STOP -eq 'before-artifacts') {
  [System.Environment]::Exit(86)
}

if (Test-Path -LiteralPath $BackupDir -PathType Container) {
  Assert-OwnedInstallDirectory -Directory $BackupDir -LogicalInstallDir $InstallDir
  Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction Stop
}

if ($env:SUBTITLE_BRIDGE_TEST_COMMITTED_CLEANUP_STOP -eq 'after-backup') {
  [System.Environment]::Exit(87)
}

Remove-OwnedTransactionDirectory -Directory $MetadataDir -TransactionId $transactionId -Role 'metadata' -LogicalInstallDir $InstallDir

if ($env:SUBTITLE_BRIDGE_TEST_COMMITTED_CLEANUP_STOP -eq 'after-metadata') {
  [System.Environment]::Exit(88)
}

Remove-Item -LiteralPath $TransactionMarkerPath -Force -ErrorAction Stop

if (-not $NoLaunch) {
  Start-Process -FilePath $ExePath
}
} finally {
  if ($InstallMutexHeld -and $null -ne $InstallMutex) {
    try {
      $InstallMutex.ReleaseMutex()
    } catch {
      # The process may be terminating through a test-only hard-exit hook.
    }
    $InstallMutex.Dispose()
  }
}
