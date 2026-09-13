param(
  [string]$ServerJsPath
)

$ErrorActionPreference = 'Stop'

$MarkerBegin = '/* Subtitle Bridge external player BEGIN */'
$MarkerEnd = '/* Subtitle Bridge external player END */'
$ExternalDevicesPattern = 'devices\.groups\.external\s*=\s*\[\s*\]\s*;?'

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
      $content = [System.IO.File]::ReadAllText($candidate)
      if ($content.Contains($MarkerBegin) -or [regex]::IsMatch($content, $ExternalDevicesPattern)) {
        return $candidate
      }
    } catch {
      # Ignore unreadable unrelated candidates and keep looking.
    }
  }

  throw 'Could not locate Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ServerJsPath = Resolve-StremioServerJs $ServerJsPath
$content = [System.IO.File]::ReadAllText($ServerJsPath)
$markerPattern = [regex]::Escape($MarkerBegin) + '.*?' + [regex]::Escape($MarkerEnd) + '\r?\n?'
$cleaned = [regex]::Replace(
  $content,
  $markerPattern,
  '',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($cleaned -eq $content) {
  Write-Host 'Subtitle Bridge is not currently patched into this Stremio server.js. Nothing was changed.'
  exit 0
}

[System.IO.File]::WriteAllText(
  $ServerJsPath,
  $cleaned,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Removed Subtitle Bridge from Stremio external-player list: $ServerJsPath"
Write-Host 'Fully exit and reopen Stremio for the change to take effect.'
