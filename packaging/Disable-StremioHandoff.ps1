param(
  [string]$ServerJsPath,
  [switch]$AllowMissing
)

$ErrorActionPreference = 'Stop'

$MarkerBegin = '/* Subtitle Bridge external player BEGIN */'
$MarkerEnd = '/* Subtitle Bridge external player END */'
$GeneratedPatchPattern = (
  '(?s)^\s*' +
  [regex]::Escape($MarkerBegin) +
  '\s*players\.subtitleBridge\s*=\s*\{\s*' +
  'title\s*:\s*"Subtitle Bridge"\s*,\s*' +
  'args\s*:\s*\[\s*""\s*\]\s*,\s*' +
  'subArg\s*:\s*""\s*,\s*' +
  'timeArg\s*:\s*""\s*,\s*' +
  'playArg\s*:\s*""\s*,\s*' +
  'darwin\s*:\s*\{\s*path\s*:\s*\[\s*\]\s*\}\s*,\s*' +
  'linux\s*:\s*\{\s*path\s*:\s*\[\s*\]\s*\}\s*,\s*' +
  'win32\s*:\s*\{\s*path\s*:\s*\[\s*"(?:\\.|[^"\\])*"\s*\]\s*\}\s*' +
  '\}\s*;\s*' +
  [regex]::Escape($MarkerEnd) +
  '\s*$'
)

function Get-StremioTargetStatePath {
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_STREMIO_TARGETS_PATH)) {
    return [System.IO.Path]::GetFullPath($env:SUBTITLE_BRIDGE_STREMIO_TARGETS_PATH)
  }

  return [System.IO.Path]::GetFullPath(
    (Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\stremio-handoff-targets.json')
  )
}

function Read-StremioTargetPaths {
  $statePath = Get-StremioTargetStatePath
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
    return @()
  }

  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  } catch {
    throw "The saved Stremio handoff target record is unreadable: $statePath"
  }

  if ($state.version -ne 1 -or [string]$state.application -ne 'Subtitle Bridge') {
    throw "The saved Stremio handoff target record has an unsupported format: $statePath"
  }

  $paths = New-Object System.Collections.Generic.List[string]
  foreach ($path in @($state.paths)) {
    if ([string]::IsNullOrWhiteSpace([string]$path)) {
      throw "The saved Stremio handoff target record contains an invalid path: $statePath"
    }
    $paths.Add([System.IO.Path]::GetFullPath([string]$path))
  }

  return @($paths | Select-Object -Unique)
}

function Write-StremioTargetPaths {
  param([AllowEmptyCollection()][string[]]$Paths)

  $statePath = Get-StremioTargetStatePath
  $stateDir = Split-Path -Parent $statePath

  if ($null -eq $Paths -or $Paths.Count -eq 0) {
    if (Test-Path -LiteralPath $statePath) {
      Remove-Item -LiteralPath $statePath -Force -ErrorAction Stop
    }
    return
  }

  New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
  $normalized = @($Paths | ForEach-Object {
    [System.IO.Path]::GetFullPath($_)
  } | Select-Object -Unique)

  $tempPath = "$statePath.tmp"
  try {
    [ordered]@{
      version = 1
      application = 'Subtitle Bridge'
      paths = $normalized
    } |
      ConvertTo-Json -Depth 4 |
      Set-Content -LiteralPath $tempPath -Encoding UTF8

    Move-Item -LiteralPath $tempPath -Destination $statePath -Force -ErrorAction Stop
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-PatchState([string]$Text) {
  $beginCount = ([regex]::Matches($Text, [regex]::Escape($MarkerBegin))).Count
  $endCount = ([regex]::Matches($Text, [regex]::Escape($MarkerEnd))).Count

  if ($beginCount -eq 0 -and $endCount -eq 0) {
    return $false
  }

  if ($beginCount -ne 1 -or $endCount -ne 1) {
    throw 'Stremio server.js contains malformed or duplicate Subtitle Bridge patch markers. No changes were written.'
  }

  $beginIndex = $Text.IndexOf($MarkerBegin, [System.StringComparison]::Ordinal)
  $endIndex = $Text.IndexOf($MarkerEnd, [System.StringComparison]::Ordinal)
  if ($beginIndex -lt 0 -or $endIndex -le $beginIndex) {
    throw 'Stremio server.js contains malformed Subtitle Bridge patch markers. No changes were written.'
  }

  return $true
}

function Get-PatchBlock([string]$Text) {
  $hasPatch = Get-PatchState $Text
  if (-not $hasPatch) {
    return $null
  }

  $beginIndex = $Text.IndexOf($MarkerBegin, [System.StringComparison]::Ordinal)
  $endIndex = $Text.IndexOf($MarkerEnd, [System.StringComparison]::Ordinal) + $MarkerEnd.Length
  return $Text.Substring($beginIndex, $endIndex - $beginIndex)
}

function Assert-GeneratedPatchBlock([string]$PatchBlock) {
  if (-not [regex]::IsMatch($PatchBlock, $GeneratedPatchPattern)) {
    throw 'The Subtitle Bridge marker block was modified and cannot be removed automatically. No changes were written.'
  }
}

function Remove-PatchBlock([string]$Text) {
  $hasPatch = Get-PatchState $Text
  if (-not $hasPatch) {
    return $Text
  }

  $markerPattern = [regex]::Escape($MarkerBegin) + '.*?' + [regex]::Escape($MarkerEnd) + '\r?\n?'
  return [regex]::Replace(
    $Text,
    $markerPattern,
    '',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
}

function Write-AtomicUtf8([string]$Path, [string]$Text) {
  $directory = Split-Path -Parent $Path
  $token = [Guid]::NewGuid().ToString('N')
  $tempPath = Join-Path $directory ('.subtitle-bridge-' + $token + '.tmp')
  $replaceBackupPath = Join-Path $directory ('.subtitle-bridge-replace-' + $token + '.bak')

  try {
    [System.IO.File]::WriteAllText($tempPath, $Text, [System.Text.UTF8Encoding]::new($false))
    if ([System.IO.File]::ReadAllText($tempPath) -ne $Text) {
      throw 'Could not verify the temporary Stremio patch file.'
    }

    if ($env:SUBTITLE_BRIDGE_TEST_FORCE_STREMIO_REPLACE_FAILURE -eq '1') {
      throw 'Simulated Stremio atomic replacement failure.'
    }

    [System.IO.File]::Replace($tempPath, $Path, $replaceBackupPath)
  } finally {
    if (Test-Path -LiteralPath $tempPath) {
      Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $replaceBackupPath) {
      Remove-Item -LiteralPath $replaceBackupPath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-StremioCandidatePaths {
  param([string]$ExplicitPath)

  $candidates = New-Object System.Collections.Generic.List[string]

  foreach ($recordedPath in @(Read-StremioTargetPaths)) {
    $candidates.Add([System.IO.Path]::GetFullPath($recordedPath))
  }

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    $resolved = [System.IO.Path]::GetFullPath($ExplicitPath)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      throw "Stremio server.js was not found: $resolved"
    }
    $candidates.Add($resolved)
  }

  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like 'Stremio*' } |
    ForEach-Object {
      try {
        if ($_.Path) {
          $candidate = Join-Path (Split-Path -Parent $_.Path) 'server.js'
          if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $candidates.Add([System.IO.Path]::GetFullPath($candidate))
          }
        }
      } catch {
        # Filesystem discovery and persisted targets remain authoritative.
      }
    }

  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\LNV'),
    (Join-Path $env:LOCALAPPDATA 'Programs')
  ) | Select-Object -Unique

  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
      continue
    }

    try {
      Get-ChildItem -LiteralPath $root -Filter 'server.js' -File -Recurse -ErrorAction Stop |
        Where-Object { $_.FullName -match '(?i)stremio' } |
        ForEach-Object { $candidates.Add([System.IO.Path]::GetFullPath($_.FullName)) }
    } catch {
      throw "Could not safely inspect Stremio installations under: $root"
    }
  }

  return @($candidates | Select-Object -Unique)
}

$ServerJsPaths = @(Get-StremioCandidatePaths -ExplicitPath $ServerJsPath)
if ($ServerJsPaths.Count -eq 0) {
  if ($AllowMissing) {
    Write-Host 'No recorded or discoverable Stremio installation was found. Nothing was changed.'
    exit 0
  }

  throw 'Could not locate a Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$removedAny = $false

foreach ($resolvedServerJsPath in $ServerJsPaths) {
  if (-not (Test-Path -LiteralPath $resolvedServerJsPath -PathType Leaf)) {
    # A persisted target may legitimately disappear because Stremio was removed. It cannot
    # contain a dangling patch if the file no longer exists, so it is safe to forget on success.
    continue
  }

  try {
    $content = [System.IO.File]::ReadAllText($resolvedServerJsPath)
  } catch {
    throw "Could not read a recorded or discovered Stremio server.js. Cleanup was aborted: $resolvedServerJsPath"
  }

  $patchBlock = Get-PatchBlock $content
  if ($null -eq $patchBlock) {
    continue
  }

  # Removing our own exact generated block is safe even if a Stremio update changed the
  # surrounding discovery code. Anything edited inside the markers still fails closed.
  Assert-GeneratedPatchBlock $patchBlock
  $cleaned = Remove-PatchBlock $content

  if ($cleaned -eq $content) {
    throw "Subtitle Bridge patch markers were found but the patch block could not be removed safely: $resolvedServerJsPath"
  }

  Write-AtomicUtf8 $resolvedServerJsPath $cleaned
  $removedAny = $true
  Write-Host "Removed Subtitle Bridge from Stremio external-player list: $resolvedServerJsPath"
}

# Only clear persisted targets after every recorded/discovered candidate was readable and all
# patch removals succeeded. Any failure above keeps the record so uninstall can retry safely.
Write-StremioTargetPaths -Paths @()

if (-not $removedAny) {
  Write-Host 'Subtitle Bridge is not currently patched into any recorded or discovered Stremio server.js. Nothing was changed.'
  exit 0
}

Write-Host 'Safety backups are retained for manual recovery and are never restored over a newer Stremio installation.'
Write-Host 'Fully exit and reopen Stremio for the change to take effect.'

)

function Get-StremioTargetStatePath {
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_STREMIO_TARGETS_PATH)) {
    return [System.IO.Path]::GetFullPath($env:SUBTITLE_BRIDGE_STREMIO_TARGETS_PATH)
  }

  return [System.IO.Path]::GetFullPath(
    (Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\stremio-handoff-targets.json')
  )
}

function Read-StremioTargetPaths {
  $statePath = Get-StremioTargetStatePath
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
    return @()
  }

  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  } catch {
    throw "The saved Stremio handoff target record is unreadable: $statePath"
  }

  if ($state.version -ne 1 -or [string]$state.application -ne 'Subtitle Bridge') {
    throw "The saved Stremio handoff target record has an unsupported format: $statePath"
  }

  $paths = New-Object System.Collections.Generic.List[string]
  foreach ($path in @($state.paths)) {
    if ([string]::IsNullOrWhiteSpace([string]$path)) {
      throw "The saved Stremio handoff target record contains an invalid path: $statePath"
    }
    $paths.Add([System.IO.Path]::GetFullPath([string]$path))
  }

  return @($paths | Select-Object -Unique)
}

function Write-StremioTargetPaths {
  param([AllowEmptyCollection()][string[]]$Paths)

  $statePath = Get-StremioTargetStatePath
  $stateDir = Split-Path -Parent $statePath

  if ($null -eq $Paths -or $Paths.Count -eq 0) {
    if (Test-Path -LiteralPath $statePath) {
      Remove-Item -LiteralPath $statePath -Force -ErrorAction Stop
    }
    return
  }

  New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
  $normalized = @($Paths | ForEach-Object {
    [System.IO.Path]::GetFullPath($_)
  } | Select-Object -Unique)

  $tempPath = "$statePath.tmp"
  try {
    [ordered]@{
      version = 1
      application = 'Subtitle Bridge'
      paths = $normalized
    } |
      ConvertTo-Json -Depth 4 |
      Set-Content -LiteralPath $tempPath -Encoding UTF8

    Move-Item -LiteralPath $tempPath -Destination $statePath -Force -ErrorAction Stop
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-PatchState([string]$Text) {
  $beginCount = ([regex]::Matches($Text, [regex]::Escape($MarkerBegin))).Count
  $endCount = ([regex]::Matches($Text, [regex]::Escape($MarkerEnd))).Count

  if ($beginCount -eq 0 -and $endCount -eq 0) {
    return $false
  }

  if ($beginCount -ne 1 -or $endCount -ne 1) {
    throw 'Stremio server.js contains malformed or duplicate Subtitle Bridge patch markers. No changes were written.'
  }

  $beginIndex = $Text.IndexOf($MarkerBegin, [System.StringComparison]::Ordinal)
  $endIndex = $Text.IndexOf($MarkerEnd, [System.StringComparison]::Ordinal)
  if ($beginIndex -lt 0 -or $endIndex -le $beginIndex) {
    throw 'Stremio server.js contains malformed Subtitle Bridge patch markers. No changes were written.'
  }

  return $true
}

function Remove-PatchBlock([string]$Text) {
  $hasPatch = Get-PatchState $Text
  if (-not $hasPatch) {
    return $Text
  }

  $markerPattern = [regex]::Escape($MarkerBegin) + '.*?' + [regex]::Escape($MarkerEnd) + '\r?\n?'
  return [regex]::Replace(
    $Text,
    $markerPattern,
    '',
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
}

function Assert-CompatibleStremioLayout([string]$Text) {
  $discoveryMatches = [regex]::Matches($Text, $ExternalDevicesPattern)
  if ($discoveryMatches.Count -ne 1) {
    throw 'This Stremio server.js external-player layout is not recognized. No changes were written.'
  }

  $discovery = $discoveryMatches[0]
  $prefixStart = [Math]::Max(0, $discovery.Index - 50000)
  $prefix = $Text.Substring($prefixStart, $discovery.Index - $prefixStart)
  if ([regex]::Matches($prefix, $PlayersDeclarationPattern).Count -lt 1) {
    throw 'This Stremio server.js player table is not recognized. No changes were written.'
  }

  $suffixLength = [Math]::Min(50000, $Text.Length - $discovery.Index)
  $suffix = $Text.Substring($discovery.Index, $suffixLength)
  if (-not [regex]::IsMatch($suffix, $PlatformPathPattern) -or -not [regex]::IsMatch($suffix, $ExternalPushPattern)) {
    throw 'This Stremio server.js player discovery logic is not recognized. No changes were written.'
  }
}

function Write-AtomicUtf8([string]$Path, [string]$Text) {
  $directory = Split-Path -Parent $Path
  $token = [Guid]::NewGuid().ToString('N')
  $tempPath = Join-Path $directory ('.subtitle-bridge-' + $token + '.tmp')
  $replaceBackupPath = Join-Path $directory ('.subtitle-bridge-replace-' + $token + '.bak')

  try {
    [System.IO.File]::WriteAllText($tempPath, $Text, [System.Text.UTF8Encoding]::new($false))
    if ([System.IO.File]::ReadAllText($tempPath) -ne $Text) {
      throw 'Could not verify the temporary Stremio patch file.'
    }

    if ($env:SUBTITLE_BRIDGE_TEST_FORCE_STREMIO_REPLACE_FAILURE -eq '1') {
      throw 'Simulated Stremio atomic replacement failure.'
    }

    [System.IO.File]::Replace($tempPath, $Path, $replaceBackupPath)
  } finally {
    if (Test-Path -LiteralPath $tempPath) {
      Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $replaceBackupPath) {
      Remove-Item -LiteralPath $replaceBackupPath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-StremioCandidatePaths {
  param([string]$ExplicitPath)

  $candidates = New-Object System.Collections.Generic.List[string]

  foreach ($recordedPath in @(Read-StremioTargetPaths)) {
    $candidates.Add([System.IO.Path]::GetFullPath($recordedPath))
  }

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    $resolved = [System.IO.Path]::GetFullPath($ExplicitPath)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      throw "Stremio server.js was not found: $resolved"
    }
    $candidates.Add($resolved)
  }

  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like 'Stremio*' } |
    ForEach-Object {
      try {
        if ($_.Path) {
          $candidate = Join-Path (Split-Path -Parent $_.Path) 'server.js'
          if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $candidates.Add([System.IO.Path]::GetFullPath($candidate))
          }
        }
      } catch {
        # Filesystem discovery and persisted targets remain authoritative.
      }
    }

  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\LNV'),
    (Join-Path $env:LOCALAPPDATA 'Programs')
  ) | Select-Object -Unique

  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
      continue
    }

    try {
      Get-ChildItem -LiteralPath $root -Filter 'server.js' -File -Recurse -ErrorAction Stop |
        Where-Object { $_.FullName -match '(?i)stremio' } |
        ForEach-Object { $candidates.Add([System.IO.Path]::GetFullPath($_.FullName)) }
    } catch {
      throw "Could not safely inspect Stremio installations under: $root"
    }
  }

  return @($candidates | Select-Object -Unique)
}

$ServerJsPaths = @(Get-StremioCandidatePaths -ExplicitPath $ServerJsPath)
if ($ServerJsPaths.Count -eq 0) {
  if ($AllowMissing) {
    Write-Host 'No recorded or discoverable Stremio installation was found. Nothing was changed.'
    exit 0
  }

  throw 'Could not locate a Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$removedAny = $false

foreach ($resolvedServerJsPath in $ServerJsPaths) {
  if (-not (Test-Path -LiteralPath $resolvedServerJsPath -PathType Leaf)) {
    # A persisted target may legitimately disappear because Stremio was removed. It cannot
    # contain a dangling patch if the file no longer exists, so it is safe to forget on success.
    continue
  }

  try {
    $content = [System.IO.File]::ReadAllText($resolvedServerJsPath)
  } catch {
    throw "Could not read a recorded or discovered Stremio server.js. Cleanup was aborted: $resolvedServerJsPath"
  }

  $hasPatch = Get-PatchState $content
  if (-not $hasPatch) {
    continue
  }

  $cleaned = Remove-PatchBlock $content
  Assert-CompatibleStremioLayout $cleaned

  if ($cleaned -eq $content) {
    throw "Subtitle Bridge patch markers were found but the patch block could not be removed safely: $resolvedServerJsPath"
  }

  Write-AtomicUtf8 $resolvedServerJsPath $cleaned
  $removedAny = $true
  Write-Host "Removed Subtitle Bridge from Stremio external-player list: $resolvedServerJsPath"
}

# Only clear persisted targets after every recorded/discovered candidate was readable and all
# patch removals succeeded. Any failure above keeps the record so uninstall can retry safely.
Write-StremioTargetPaths -Paths @()

if (-not $removedAny) {
  Write-Host 'Subtitle Bridge is not currently patched into any recorded or discovered Stremio server.js. Nothing was changed.'
  exit 0
}

Write-Host 'Safety backups are retained for manual recovery and are never restored over a newer Stremio installation.'
Write-Host 'Fully exit and reopen Stremio for the change to take effect.'
