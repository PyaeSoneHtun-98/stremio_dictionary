param(
  [string]$ServerJsPath,
  [switch]$AllowMissing
)

$ErrorActionPreference = 'Stop'

$MarkerBegin = '/* Subtitle Bridge external player BEGIN */'
$MarkerEnd = '/* Subtitle Bridge external player END */'
$ExternalDevicesPattern = 'devices\.groups\.external\s*=\s*\[\s*\]\s*[,;]\s*Object\.keys\(players\)\.forEach'
$PlayersDeclarationPattern = '\b(?:var|let|const)\s+players\s*=\s*\{'
$PlatformPathPattern = 'player\[process\.platform\]\s*&&\s*player\[process\.platform\]\.path\.forEach'
$ExternalPushPattern = 'devices\.groups\.external\.push'

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

    # CI uses this fail-before-replace hook to prove that a failed removal leaves the
    # currently patched server.js untouched. If a user sets it, failing closed is safe.
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

function Resolve-StremioServerJsPaths([string]$ExplicitPath) {
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
        # Continue with filesystem discovery.
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

    Get-ChildItem -LiteralPath $root -Filter 'server.js' -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '(?i)stremio' } |
      ForEach-Object { $candidates.Add([System.IO.Path]::GetFullPath($_.FullName)) }
  }

  $patchedCandidates = New-Object System.Collections.Generic.List[string]
  $compatibleCandidates = New-Object System.Collections.Generic.List[string]

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $candidateContent = [System.IO.File]::ReadAllText($candidate)
    } catch {
      continue
    }

    if ($candidateContent.Contains($MarkerBegin) -or $candidateContent.Contains($MarkerEnd)) {
      # Do not hide malformed markers on any discovered installation. Uninstall must fail
      # closed rather than delete Subtitle Bridge while a Stremio patch may remain.
      if (Get-PatchState $candidateContent) {
        $patchedCandidates.Add($candidate)
      }
      continue
    }

    try {
      Assert-CompatibleStremioLayout $candidateContent
      $compatibleCandidates.Add($candidate)
    } catch {
      # Ignore incompatible unpatched Stremio files and keep looking.
    }
  }

  if ($patchedCandidates.Count -gt 0) {
    return $patchedCandidates
  }

  if ($compatibleCandidates.Count -gt 0) {
    return $compatibleCandidates[0]
  }

  if ($AllowMissing) {
    return
  }

  throw 'Could not locate a compatible Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ServerJsPaths = @(Resolve-StremioServerJsPaths $ServerJsPath)
if ($ServerJsPaths.Count -eq 0) {
  Write-Host 'No compatible Stremio installation was found. Nothing was changed.'
  exit 0
}

$removedAny = $false

foreach ($resolvedServerJsPath in $ServerJsPaths) {
  $content = [System.IO.File]::ReadAllText($resolvedServerJsPath)
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

if (-not $removedAny) {
  Write-Host 'Subtitle Bridge is not currently patched into the discovered Stremio installation. Nothing was changed.'
  exit 0
}

Write-Host 'Safety backups are retained for manual recovery and are never restored over a newer Stremio installation.'
Write-Host 'Fully exit and reopen Stremio for the change to take effect.'
