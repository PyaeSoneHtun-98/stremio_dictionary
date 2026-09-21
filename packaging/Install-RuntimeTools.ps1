param(
  [Parameter(Mandatory = $true)][string]$DestinationRoot,
  [Parameter(Mandatory = $true)][string]$ManifestPath,
  [string]$CacheDir = (Join-Path $env:LOCALAPPDATA 'Subtitle Bridge\RuntimeCache')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null

function Test-KnownRuntimeCacheEntry {
  param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Entry)

  if ($Entry.Name -eq '.subtitle-bridge-runtime-cache.json') {
    return $true
  }

  if ($Entry.PSIsContainer) {
    return ($Entry.Name -match '^(mpv|ffmpeg)-extracted-[0-9a-f]{64}$')
  }

  return ($Entry.Name -match '^(mpv|ffmpeg)-[0-9a-f]{64}\.zip(?:\.download)?$')
}

function Initialize-RuntimeCacheOwnership {
  param([Parameter(Mandatory = $true)][string]$Directory)

  $markerPath = Join-Path $Directory '.subtitle-bridge-runtime-cache.json'

  if (Test-Path -LiteralPath $Directory -PathType Container) {
    if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
      try {
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
      } catch {
        throw "The Subtitle Bridge runtime-cache ownership marker is unreadable: $markerPath"
      }

      $recorded = [System.IO.Path]::GetFullPath([string]$marker.cacheDir).TrimEnd('\').TrimEnd('/')
      if ($marker.version -ne 1 -or
          [string]$marker.application -ne 'Subtitle Bridge' -or
          -not $recorded.Equals($Directory, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "The runtime-cache directory has an invalid Subtitle Bridge ownership marker: $Directory"
      }
      return
    }

    $entries = @(Get-ChildItem -LiteralPath $Directory -Force)
    if ($entries.Count -gt 0) {
      foreach ($entry in $entries) {
        if (-not (Test-KnownRuntimeCacheEntry -Entry $entry)) {
          throw "Refusing to use a non-empty runtime-cache directory that is not owned by Subtitle Bridge: $Directory"
        }
      }
      Write-Host 'Migrating a legacy Subtitle Bridge runtime cache to the ownership-marker format.'
    }
  } else {
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  }

  [ordered]@{
    version = 1
    application = 'Subtitle Bridge'
    cacheDir = $Directory
  } |
    ConvertTo-Json -Depth 3 |
    Set-Content -LiteralPath $markerPath -Encoding UTF8
}

function Get-NormalizedSha256 {
  param([Parameter(Mandatory = $true)][string]$Value)

  $normalized = $Value.Trim().ToLowerInvariant()
  if ($normalized -notmatch '^[0-9a-f]{64}$') {
    throw "Invalid SHA-256 value in runtime manifest: $Value"
  }

  return $normalized
}

function Get-FileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()

  try {
    $hashBytes = $sha256.ComputeHash($stream)
    return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

function Expand-ZipArchive {
  param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$DestinationPath
  )

  if (Test-Path -LiteralPath $DestinationPath) {
    Remove-Item -LiteralPath $DestinationPath -Recurse -Force
  }

  [System.IO.Directory]::CreateDirectory($DestinationPath) | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $DestinationPath)
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
  $client = New-Object System.Net.WebClient
  try {
    $client.DownloadFile($uri.AbsoluteUri, $Destination)
  } finally {
    $client.Dispose()
  }
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

  $archivePath = Join-Path $CacheDir "$Key-$expectedHash.zip"
  $extractDir = Join-Path $CacheDir "$Key-extracted-$expectedHash"

  Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue

  try {
    $archiveReady = $false

    if (Test-Path -LiteralPath $archivePath -PathType Leaf) {
      $cachedHash = Get-FileSha256 -Path $archivePath
      if ($cachedHash -eq $expectedHash) {
        $archiveReady = $true
        Write-Host "Using cached verified $displayName runtime archive."
      } else {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
      }
    }

    if (-not $archiveReady) {
      $downloadPath = "$archivePath.download"
      Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue

      try {
        try {
          Copy-OrDownloadArchive -Source $archiveUrl -Destination $downloadPath
        } catch {
          throw "Could not download the required $displayName runtime. Check your internet connection and try again."
        }

        $actualHash = Get-FileSha256 -Path $downloadPath
        if ($actualHash -ne $expectedHash) {
          throw "$displayName runtime archive failed SHA-256 verification. The downloaded file was not installed."
        }

        Move-Item -LiteralPath $downloadPath -Destination $archivePath -Force
      } finally {
        Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue
      }
    }

    $verifiedHash = Get-FileSha256 -Path $archivePath
    if ($verifiedHash -ne $expectedHash) {
      Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
      throw "$displayName cached runtime archive failed SHA-256 verification."
    }

    Expand-ZipArchive -ArchivePath $archivePath -DestinationPath $extractDir

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
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$ManifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
$DestinationRoot = [System.IO.Path]::GetFullPath($DestinationRoot)
$CacheDir = [System.IO.Path]::GetFullPath($CacheDir).TrimEnd('\').TrimEnd('/')

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw "Runtime manifest was not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne 1) {
  throw "Unsupported runtime manifest version: $($manifest.version)"
}

Initialize-RuntimeCacheOwnership -Directory $CacheDir

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
