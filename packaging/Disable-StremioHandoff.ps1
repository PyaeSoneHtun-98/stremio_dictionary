param(
  [string]$ServerJsPath
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
  $tempPath = Join-Path $directory ('.subtitle-bridge-' + [Guid]::NewGuid().ToString('N') + '.tmp')

  try {
    [System.IO.File]::WriteAllText($tempPath, $Text, [System.Text.UTF8Encoding]::new($false))
    if ([System.IO.File]::ReadAllText($tempPath) -ne $Text) {
      throw 'Could not verify the temporary Stremio patch file.'
    }

    [System.IO.File]::Replace($tempPath, $Path, $null)
  } finally {
    if (Test-Path -LiteralPath $tempPath) {
      Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
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

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    try {
      $candidateContent = [System.IO.File]::ReadAllText($candidate)
      if ($candidateContent.Contains($MarkerBegin) -or $candidateContent.Contains($MarkerEnd)) {
        return $candidate
      }

      Assert-CompatibleStremioLayout $candidateContent
      return $candidate
    } catch {
      # Ignore unreadable or incompatible candidates and keep looking.
    }
  }

  throw 'Could not locate a compatible Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ServerJsPath = Resolve-StremioServerJs $ServerJsPath
$content = [System.IO.File]::ReadAllText($ServerJsPath)
$hasPatch = Get-PatchState $content

if (-not $hasPatch) {
  Write-Host 'Subtitle Bridge is not currently patched into this Stremio server.js. Nothing was changed.'
  exit 0
}

$cleaned = Remove-PatchBlock $content
Assert-CompatibleStremioLayout $cleaned

if ($cleaned -eq $content) {
  throw 'Subtitle Bridge patch markers were found but the patch block could not be removed safely.'
}

Write-AtomicUtf8 $ServerJsPath $cleaned

Write-Host "Removed Subtitle Bridge from Stremio external-player list: $ServerJsPath"
Write-Host 'Safety backups are retained for manual recovery and are never restored over a newer Stremio installation.'
Write-Host 'Fully exit and reopen Stremio for the change to take effect.'
