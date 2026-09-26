param(
  [string]$ExecutablePath = (Join-Path $PSScriptRoot 'Subtitle Bridge.exe'),
  [string]$ServerJsPath
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
  '\s*
$ExternalDevicesPattern = 'devices\.groups\.external\s*=\s*\[\s*\]\s*[,;]\s*Object\.keys\(players\)\.forEach'
$PlayersDeclarationPattern = '\b(?:var|let|const)\s+players\s*=\s*\{'
$PlatformPathPattern = 'player\[process\.platform\]\s*&&\s*player\[process\.platform\]\.path\.forEach'
$ExternalPushPattern = 'devices\.groups\.external\.push'

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
  param([Parameter(Mandatory = $true)][string[]]$Paths)

  $statePath = Get-StremioTargetStatePath
  $stateDir = Split-Path -Parent $statePath

  if ($Paths.Count -eq 0) {
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

function Record-StremioTarget {
  param([Parameter(Mandatory = $true)][string]$Path)

  $resolved = [System.IO.Path]::GetFullPath($Path)
  $paths = @(Read-StremioTargetPaths)
  if ($paths -notcontains $resolved) {
    $paths += $resolved
  }
  Write-StremioTargetPaths -Paths $paths
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
    throw 'The existing Subtitle Bridge marker block was modified and cannot be replaced automatically. No changes were written.'
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

function Assert-CompatibleStremioLayout([string]$Text) {
  $discoveryMatches = [regex]::Matches($Text, $ExternalDevicesPattern)
  if ($discoveryMatches.Count -ne 1) {
    throw 'This Stremio server.js external-player layout is not recognized. No changes were written.'
  }

  $discovery = $discoveryMatches[0]
  $prefixStart = [Math]::Max(0, $discovery.Index - 50000)
  $prefix = $Text.Substring($prefixStart, $discovery.Index - $prefixStart)
  $playerDeclarations = [regex]::Matches($prefix, $PlayersDeclarationPattern)
  if ($playerDeclarations.Count -lt 1) {
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

function Resolve-StremioServerJs([string]$ExplicitPath) {
  if ($ExplicitPath) {
    $resolved = [System.IO.Path]::GetFullPath($ExplicitPath)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      throw "Stremio server.js was not found: $resolved"
    }
    return $resolved
  }

  $candidates = New-Object System.Collections.Generic.List[string]

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
        # Process-path access can fail; filesystem discovery below remains authoritative.
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

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $candidateContent = [System.IO.File]::ReadAllText($candidate)
    } catch {
      throw "Could not read a discovered Stremio server.js safely: $candidate"
    }

    if ($candidateContent.Contains($MarkerBegin) -or $candidateContent.Contains($MarkerEnd)) {
      $candidatePatchBlock = Get-PatchBlock $candidateContent
      Assert-GeneratedPatchBlock $candidatePatchBlock
      $candidateBase = Remove-PatchBlock $candidateContent
      Assert-CompatibleStremioLayout $candidateBase
      return $candidate
    }

    try {
      Assert-CompatibleStremioLayout $candidateContent
      return $candidate
    } catch {
      # Readable but incompatible unrelated candidate; keep looking.
    }
  }

  throw 'Could not locate a compatible Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ExecutablePath = [System.IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
  throw "Subtitle Bridge executable was not found: $ExecutablePath"
}

$ServerJsPath = Resolve-StremioServerJs $ServerJsPath
$content = [System.IO.File]::ReadAllText($ServerJsPath)
$hasExistingPatch = Get-PatchState $content
if ($hasExistingPatch) {
  Assert-GeneratedPatchBlock (Get-PatchBlock $content)
}
$baseContent = Remove-PatchBlock $content

Assert-CompatibleStremioLayout $baseContent
$externalMatch = [regex]::Match($baseContent, $ExternalDevicesPattern)

Record-StremioTarget -Path $ServerJsPath

$quotedExecutable = '"' + $ExecutablePath + '"'
$jsExecutable = ConvertTo-Json $quotedExecutable -Compress
$block = @"
$MarkerBegin
players.subtitleBridge = {
    title: "Subtitle Bridge",
    args: [ "" ],
    subArg: "",
    timeArg: "",
    playArg: "",
    darwin: { path: [] },
    linux: { path: [] },
    win32: { path: [ $jsExecutable ] }
};
$MarkerEnd
"@

$patched = $baseContent.Insert($externalMatch.Index, "$block`r`n")

if ($patched -eq $content) {
  Write-Host 'Subtitle Bridge is already enabled for this Stremio server.js. Target record verified.'
  exit 0
}

$backupPath = $null
if (-not $hasExistingPatch) {
  $primaryBackupPath = "$ServerJsPath.subtitle-bridge.backup"
  if (-not (Test-Path -LiteralPath $primaryBackupPath)) {
    $backupPath = $primaryBackupPath
  } else {
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $backupPath = "$primaryBackupPath.$stamp.$suffix"
  }

  Copy-Item -LiteralPath $ServerJsPath -Destination $backupPath
}

Write-AtomicUtf8 $ServerJsPath $patched

Write-Host "Patched Stremio external-player list: $ServerJsPath"
if ($backupPath) {
  Write-Host "Safety backup: $backupPath"
}
Write-Host 'Fully exit and reopen Stremio. Then open a stream and use the three-dot menu -> Play in Subtitle Bridge.'
Write-Host 'Run Disable-StremioHandoff.ps1 to remove the Subtitle Bridge entry.'

)
$ExternalDevicesPattern = 'devices\.groups\.external\s*=\s*\[\s*\]\s*[,;]\s*Object\.keys\(players\)\.forEach'
$PlayersDeclarationPattern = '\b(?:var|let|const)\s+players\s*=\s*\{'
$PlatformPathPattern = 'player\[process\.platform\]\s*&&\s*player\[process\.platform\]\.path\.forEach'
$ExternalPushPattern = 'devices\.groups\.external\.push'

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
  param([Parameter(Mandatory = $true)][string[]]$Paths)

  $statePath = Get-StremioTargetStatePath
  $stateDir = Split-Path -Parent $statePath

  if ($Paths.Count -eq 0) {
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

function Record-StremioTarget {
  param([Parameter(Mandatory = $true)][string]$Path)

  $resolved = [System.IO.Path]::GetFullPath($Path)
  $paths = @(Read-StremioTargetPaths)
  if ($paths -notcontains $resolved) {
    $paths += $resolved
  }
  Write-StremioTargetPaths -Paths $paths
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
  $playerDeclarations = [regex]::Matches($prefix, $PlayersDeclarationPattern)
  if ($playerDeclarations.Count -lt 1) {
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

function Resolve-StremioServerJs([string]$ExplicitPath) {
  if ($ExplicitPath) {
    $resolved = [System.IO.Path]::GetFullPath($ExplicitPath)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
      throw "Stremio server.js was not found: $resolved"
    }
    return $resolved
  }

  $candidates = New-Object System.Collections.Generic.List[string]

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
        # Process-path access can fail; filesystem discovery below remains authoritative.
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

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $candidateContent = [System.IO.File]::ReadAllText($candidate)
    } catch {
      throw "Could not read a discovered Stremio server.js safely: $candidate"
    }

    if ($candidateContent.Contains($MarkerBegin) -or $candidateContent.Contains($MarkerEnd)) {
      $candidateBase = Remove-PatchBlock $candidateContent
      Assert-CompatibleStremioLayout $candidateBase
      return $candidate
    }

    try {
      Assert-CompatibleStremioLayout $candidateContent
      return $candidate
    } catch {
      # Readable but incompatible unrelated candidate; keep looking.
    }
  }

  throw 'Could not locate a compatible Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ExecutablePath = [System.IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
  throw "Subtitle Bridge executable was not found: $ExecutablePath"
}

$ServerJsPath = Resolve-StremioServerJs $ServerJsPath
$content = [System.IO.File]::ReadAllText($ServerJsPath)
$hasExistingPatch = Get-PatchState $content
$baseContent = Remove-PatchBlock $content

Assert-CompatibleStremioLayout $baseContent
$externalMatch = [regex]::Match($baseContent, $ExternalDevicesPattern)

Record-StremioTarget -Path $ServerJsPath

$quotedExecutable = '"' + $ExecutablePath + '"'
$jsExecutable = ConvertTo-Json $quotedExecutable -Compress
$block = @"
$MarkerBegin
players.subtitleBridge = {
    title: "Subtitle Bridge",
    args: [ "" ],
    subArg: "",
    timeArg: "",
    playArg: "",
    darwin: { path: [] },
    linux: { path: [] },
    win32: { path: [ $jsExecutable ] }
};
$MarkerEnd
"@

$patched = $baseContent.Insert($externalMatch.Index, "$block`r`n")

if ($patched -eq $content) {
  Write-Host 'Subtitle Bridge is already enabled for this Stremio server.js. Target record verified.'
  exit 0
}

$backupPath = $null
if (-not $hasExistingPatch) {
  $primaryBackupPath = "$ServerJsPath.subtitle-bridge.backup"
  if (-not (Test-Path -LiteralPath $primaryBackupPath)) {
    $backupPath = $primaryBackupPath
  } else {
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $backupPath = "$primaryBackupPath.$stamp.$suffix"
  }

  Copy-Item -LiteralPath $ServerJsPath -Destination $backupPath
}

Write-AtomicUtf8 $ServerJsPath $patched

Write-Host "Patched Stremio external-player list: $ServerJsPath"
if ($backupPath) {
  Write-Host "Safety backup: $backupPath"
}
Write-Host 'Fully exit and reopen Stremio. Then open a stream and use the three-dot menu -> Play in Subtitle Bridge.'
Write-Host 'Run Disable-StremioHandoff.ps1 to remove the Subtitle Bridge entry.'
