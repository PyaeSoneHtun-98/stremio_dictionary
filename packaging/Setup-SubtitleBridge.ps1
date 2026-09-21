$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Subtitle Bridge Setup'
$form.Width = 460
$form.Height = 150
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ControlBox = $false
$form.TopMost = $true

$label = New-Object System.Windows.Forms.Label
$label.Left = 24
$label.Top = 20
$label.Width = 400
$label.Height = 42
$label.Text = 'Installing Subtitle Bridge. This may take a minute while the media runtimes are prepared.'
$form.Controls.Add($label)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Left = 24
$progress.Top = 72
$progress.Width = 400
$progress.Height = 20
$progress.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
$progress.MarqueeAnimationSpeed = 25
$form.Controls.Add($progress)

$form.Show()
[System.Windows.Forms.Application]::DoEvents()

$extractRoot = Join-Path $env:TEMP ("SubtitleBridge-setup-" + [Guid]::NewGuid().ToString('N'))

try {
  $payloadZip = Join-Path $PSScriptRoot 'SubtitleBridge-win-x64.zip'
  if (-not (Test-Path -LiteralPath $payloadZip -PathType Leaf)) {
    throw 'The installer payload is missing.'
  }

  New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
  Expand-Archive -LiteralPath $payloadZip -DestinationPath $extractRoot -Force

  $packageDir = Join-Path $extractRoot 'SubtitleBridge-win-x64'
  $installer = Join-Path $packageDir 'Install-SubtitleBridge.ps1'
  if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw 'The extracted Subtitle Bridge package is incomplete.'
  }

  $installParameters = @{}
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_INSTALL_DIR)) {
    $installParameters['InstallDir'] = $env:SUBTITLE_BRIDGE_INSTALL_DIR
  }
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_RUNTIME_MANIFEST)) {
    $installParameters['RuntimeManifestPath'] = $env:SUBTITLE_BRIDGE_RUNTIME_MANIFEST
  }
  if (-not [string]::IsNullOrWhiteSpace($env:SUBTITLE_BRIDGE_RUNTIME_CACHE)) {
    $installParameters['RuntimeCacheDir'] = $env:SUBTITLE_BRIDGE_RUNTIME_CACHE
  }
  if ($env:SUBTITLE_BRIDGE_SETUP_NO_SHORTCUT -eq '1') {
    $installParameters['NoShortcut'] = $true
  }
  if ($env:SUBTITLE_BRIDGE_SETUP_NO_LAUNCH -eq '1') {
    $installParameters['NoLaunch'] = $true
  }

  & $installer @installParameters
  [System.Windows.Forms.Application]::DoEvents()

  $form.Close()
  exit 0
} catch {
  $form.Close()
  try {
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      'Subtitle Bridge setup failed',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    # Preserve the non-zero exit even if graphical error reporting is unavailable.
  }

  Write-Error $_
  exit 1
} finally {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
}
