param(
  [Parameter(Mandatory = $true)][string]$DestinationRoot,
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [string]$CacheDir = (Join-Path $env:TEMP 'SubtitleBridge-runtime-cache')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-NormalizedSha256 {
  param([Parameter(Mandatory = $true)][string]$Value)

  $normalized = $Value.Trim().ToLowerInvariant()
  if ($normalized -notmatch '^[0-9a-f]{64}$') {
    throw "Invalid SHA-256 value in runtime manifest: $Value"
  }
  return $normalized
}

function Copy-OrDownloadArchive {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (Test-Path -LiteralPath $Source -PathType Leaf) {
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return
  }

  $uri = $null
  if (-not [Uri]::TryCreate($Source, [UriKind]::Absolute, [ref]$uri)) {
    throw "Runtime archive source is not a valid local path or absolute URI: $Source"
  }

  if ($uri.Scheme -eq 'file') {
    Copy-Item -LiteralPath $uri.LocalPath -Destination $Destination -Force
    return
  }

  if ($uri.Scheme -ne 'https') {
    throw "Runtime archive downloads must use HTTPS: $Source"
  }

  Write-Host "Downloading runtime archive from $($uri.Host)..."
  Invoke-WebRequest -Uri $uri.AbsoluteUri -OutFile $Destination -UseBasicParsing -TimeoutSec 300
}

function Install-Runtime {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)]$Definition
  )

  $displayName = [string]$Definition.displayName
  $archiveUrl = [string]$Definition.archiveUrl
  $expectedHash = Get-NormalizedSha256 ([string]$Definition.archiveSha256)
  $executableName = [string]$Definition.executableName

  if ([string]::IsNullOrWhiteSpace($displayName) -or
      [string]::IsNullOrWhiteSpace($archiveUrl) -or
      [string]::IsNullOrWhiteSpace($executableName)) {
    throw "Runtime manifest entry '$Key' is incomplete."
  }

  New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
  $archivePath = Join-Path $CacheDir "$Key.zip"
  $extractDir = Join-Path $CacheDir "$Key-extracted"
  Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue

  try {
    Copy-OrDownloadArchive -Source $archiveUrl -Destination $archivePath

    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
      throw "$displayName runtime archive failed SHA-256 verification."
    }

    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force

    $executable = Get-ChildItem -LiteralPath $extractDir -Filter $executableName -File -Recurse |
      Select-Object -First 1

    if (-not $executable) {
      throw "$displayName runtime archive does not contain $executableName."
    }

    $sourceDirectory = Split-Path -Parent $executable.FullName
    $destinationDirectory = Join-Path $DestinationRoot $Key

    Remove-Item -LiteralPath $destinationDirectory -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    Copy-Item -LiteralPath $sourceDirectory -Destination $destinationDirectory -Recurse -Force

    $installedExecutable = Join-Path $destinationDirectory $executableName
    if (-not (Test-Path -LiteralPath $installedExecutable -PathType Leaf)) {
      throw "$displayName runtime executable was not staged correctly."
    }

    Write-Host "Prepared managed $displayName runtime."
  } finally {
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$ManifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
$DestinationRoot = [System.IO.Path]::GetFullPath($DestinationRoot)
$CacheDir = [System.IO.Path]::GetFullPath($CacheDir)

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw "Runtime manifest was not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne 1) {
  throw "Unsupported runtime manifest version: $($manifest.version)"
}

Install-Runtime -Key 'mpv' -Definition $manifest.mpv
Install-Runtime -Key 'ffmpeg' -Definition $manifest.ffmpeg

$required = @(
  (Join-Path $DestinationRoot 'mpv\mpv.exe'),
  (Join-Path $DestinationRoot 'ffmpeg\ffmpeg.exe')
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Managed runtime provisioning is incomplete: $path"
  }
}
