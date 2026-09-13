param(
  [string]$ExecutablePath = (Join-Path $PSScriptRoot 'Subtitle Bridge.exe'),
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
        # Process path access can fail for unrelated elevated processes; continue with filesystem discovery.
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
      if ([regex]::IsMatch($content, $ExternalDevicesPattern)) {
        return $candidate
      }
    } catch {
      # Ignore unreadable unrelated candidates and keep looking.
    }
  }

  throw 'Could not locate Stremio server.js automatically. Pass -ServerJsPath with the full path to Stremio\server.js.'
}

$ExecutablePath = [System.IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
  throw "Subtitle Bridge executable was not found: $ExecutablePath"
}

$ServerJsPath = Resolve-StremioServerJs $ServerJsPath
$content = [System.IO.File]::ReadAllText($ServerJsPath)
$backupPath = "$ServerJsPath.subtitle-bridge.backup"

$markerPattern = [regex]::Escape($MarkerBegin) + '.*?' + [regex]::Escape($MarkerEnd) + '\r?\n?'
$baseContent = [regex]::Replace(
  $content,
  $markerPattern,
  '',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($baseContent -eq $content) {
  Copy-Item -LiteralPath $ServerJsPath -Destination $backupPath -Force
}

$externalMatch = [regex]::Match($baseContent, $ExternalDevicesPattern)
if (-not $externalMatch.Success) {
  throw 'This Stremio server.js layout is not recognized. No changes were written.'
}

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
[System.IO.File]::WriteAllText(
  $ServerJsPath,
  $patched,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Patched Stremio external-player list: $ServerJsPath"
Write-Host "Backup: $backupPath"
Write-Host 'Fully exit and reopen Stremio. Then open a stream and use the three-dot menu -> Play in Subtitle Bridge.'
Write-Host 'Run Disable-StremioHandoff.ps1 to remove the Subtitle Bridge entry.'
