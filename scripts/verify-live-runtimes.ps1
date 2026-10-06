# Live Windows regression: real public archives, matching DLLs, text extraction, and offline cache reuse.
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $repositoryRoot 'packaging\Install-RuntimeTools.ps1'
$manifestPath = Join-Path $repositoryRoot 'packaging\runtime-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$testRoot = Join-Path $temporaryRoot ('SubtitleBridgeLiveRuntime-' + [Guid]::NewGuid().ToString('N'))
$cache = Join-Path $testRoot 'cache'
$cold = Join-Path $testRoot 'cold'
$cached = Join-Path $testRoot 'cached'

function Invoke-Provisioning {
  param([string]$Destination, [string]$Manifest, [string]$CacheDirectory)
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
    -DestinationRoot $Destination -ManifestPath $Manifest -CacheDir $CacheDirectory
  if ($LASTEXITCODE -ne 0) {
    throw 'Live runtime provisioning failed.'
  }
}

function Invoke-CheckedFfmpeg {
  param([string[]]$Arguments)
  # Only synthetic inputs are used. Keep raw third-party output out of diagnostics.
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $null = & $ffmpeg @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedPreference
  }
  if ($exitCode -ne 0) {
    throw 'Live FFmpeg synthetic subtitle fixture failed.'
  }
}

try {
  New-Item -ItemType Directory -Path $testRoot | Out-Null
  Invoke-Provisioning -Destination $cold -Manifest $manifestPath -CacheDirectory $cache
  $mpv = Join-Path $cold 'mpv\mpv.exe'
  $ffmpeg = Join-Path $cold 'ffmpeg\ffmpeg.exe'
  & $mpv --version
  if ($LASTEXITCODE -ne 0) { throw 'Provisioned mpv could not start.' }
  $version = & $ffmpeg -version
  if ($LASTEXITCODE -ne 0) { throw 'Provisioned FFmpeg could not start with its shared DLLs.' }
  $configuration = $version -join "`n"
  if ($configuration -notmatch '--enable-shared' -or
      $configuration -match '--enable-(gpl|nonfree)(?:\s|$)') {
    throw 'The pinned FFmpeg executable is not the expected LGPL shared variant.'
  }
  foreach ($dll in @('avcodec-62.dll', 'avdevice-62.dll', 'avfilter-11.dll',
      'avformat-62.dll', 'avutil-60.dll', 'swresample-6.dll', 'swscale-9.dll')) {
    if (-not (Test-Path -LiteralPath (Join-Path $cold ('ffmpeg\' + $dll)) -PathType Leaf)) {
      throw 'A required FFmpeg shared DLL was not staged.'
    }
  }

  $srt = Join-Path $testRoot 'fixture.srt'
  @'
1
00:00:00,000 --> 00:00:01,000
Synthetic runtime fixture.
'@ | Set-Content -LiteralPath $srt -Encoding UTF8
  $ass = Join-Path $testRoot 'fixture.ass'
  @'
[Script Info]
ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Synthetic runtime fixture.
'@ | Set-Content -LiteralPath $ass -Encoding UTF8
  foreach ($fixture in @($srt, $ass)) {
    $name = [IO.Path]::GetFileNameWithoutExtension($fixture)
    $mkv = Join-Path $testRoot ($name + '-' + [IO.Path]::GetExtension($fixture).TrimStart('.') + '.mkv')
    $output = $mkv + '.srt'
    Invoke-CheckedFfmpeg -Arguments @('-nostdin', '-v', 'error', '-f', 'lavfi', '-i',
      'color=c=black:s=32x32:d=1', '-i', $fixture, '-map', '0:v:0', '-map', '1:s:0',
      '-c:v', 'ffv1', '-c:s', 'copy', '-y', $mkv)
    Invoke-CheckedFfmpeg -Arguments @('-nostdin', '-v', 'error', '-i', $mkv,
      '-map', '0:s:0', '-c:s', 'srt', '-f', 'srt', '-y', $output)
    if ((Get-Content -LiteralPath $output -Raw) -notmatch 'Synthetic runtime fixture\.') {
      throw 'Embedded text subtitle extraction did not preserve the synthetic cue.'
    }
  }

  # Prove cache reuse without allowing a successful network download to hide a cache failure.
  $offlineManifest = Join-Path $testRoot 'offline-manifest.json'
  $manifest.mpv.archiveUrl = 'https://example.invalid/mpv.zip'
  $manifest.ffmpeg.archiveUrl = 'https://example.invalid/ffmpeg.zip'
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $offlineManifest -Encoding UTF8
  Invoke-Provisioning -Destination $cached -Manifest $offlineManifest -CacheDirectory $cache
  foreach ($relative in @('mpv\mpv.exe', 'ffmpeg\ffmpeg.exe', 'ffmpeg\avcodec-62.dll')) {
    $coldHash = (Get-FileHash -LiteralPath (Join-Path $cold $relative) -Algorithm SHA256).Hash
    $cachedHash = (Get-FileHash -LiteralPath (Join-Path $cached $relative) -Algorithm SHA256).Hash
    if ($coldHash -ne $cachedHash) { throw 'Cached provisioning changed the runtime bytes.' }
  }
  $null = & (Join-Path $cached 'ffmpeg\ffmpeg.exe') -version
  if ($LASTEXITCODE -ne 0) { throw 'Cached FFmpeg could not start.' }

  # A corrupt cache must not be trusted, and replacement bytes must pass the same pinned hash.
  $ffmpegArchive = Join-Path $cache ('ffmpeg-' + $manifest.ffmpeg.archiveSha256 + '.zip')
  $badArchive = Join-Path $testRoot 'invalid-archive.zip'
  [IO.File]::WriteAllText($ffmpegArchive, 'invalid cache bytes')
  [IO.File]::WriteAllText($badArchive, 'invalid download bytes')
  $manifest.ffmpeg.archiveUrl = $badArchive
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $offlineManifest -Encoding UTF8
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer `
      -DestinationRoot $cached -ManifestPath $offlineManifest -CacheDir $cache 2>&1
    $rejectedExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedPreference
  }
  if ($rejectedExitCode -eq 0) { throw 'Provisioning accepted runtime bytes with the wrong hash.' }
  if ((Test-Path -LiteralPath $ffmpegArchive) -or
      (Test-Path -LiteralPath ($ffmpegArchive + '.download')) -or
      (Test-Path -LiteralPath (Join-Path $cache ('ffmpeg-extracted-' + $manifest.ffmpeg.archiveSha256)))) {
    throw 'Rejected runtime bytes or temporary extraction were left in the cache.'
  }
  if ((Get-FileHash -LiteralPath (Join-Path $cached 'ffmpeg\ffmpeg.exe') -Algorithm SHA256).Hash -ne
      (Get-FileHash -LiteralPath $ffmpeg -Algorithm SHA256).Hash) {
    throw 'Failed runtime provisioning changed the previously staged FFmpeg executable.'
  }
  $global:LASTEXITCODE = 0
  Write-Host 'Live cold/cached runtimes, LGPL shared DLLs, SRT/ASS extraction, and corrupt archive rejection passed.'
} finally {
  # Only this uniquely owned test directory may be removed recursively.
  $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
  if (-not $resolvedTestRoot.StartsWith($temporaryRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolvedTestRoot) -notmatch '^SubtitleBridgeLiveRuntime-[0-9a-f]{32}$') {
    throw 'Refusing to clean a runtime test directory outside the temporary root.'
  }
  Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force -ErrorAction SilentlyContinue
}
