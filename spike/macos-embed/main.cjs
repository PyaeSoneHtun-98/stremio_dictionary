// Throwaway Issue #53 spike: can Homebrew mpv render inside an Electron window on macOS
// via --wid, with a transparent child overlay window on top? Removed before the PR is ready.
const { app, BaseWindow, BrowserWindow } = require('electron')
const { spawn, execFileSync } = require('node:child_process')
const { mkdtempSync } = require('node:fs')
const { createConnection } = require('node:net')
const { join } = require('node:path')

const outDir = process.env.SPIKE_OUT
const clip = process.env.SPIKE_CLIP
const mpvPath = process.env.MPV_PATH || 'mpv'

const variants = [
  { name: 'default', args: [] },
  { name: 'gpu-next-macvk', args: ['--vo=gpu-next', '--gpu-api=vulkan', '--gpu-context=macvk'] },
  { name: 'gpu-macvk', args: ['--vo=gpu', '--gpu-api=vulkan', '--gpu-context=macvk'] }
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function capture(name) {
  try {
    execFileSync('screencapture', ['-x', join(outDir, `${name}.png`)])
    console.log(`captured ${name}`)
  } catch (error) {
    console.log(`screencapture failed for ${name}: ${error.message}`)
  }
}

function mpvCommand(socketPath, command) {
  return new Promise((resolve) => {
    const socket = createConnection(socketPath)
    let buffer = ''
    socket.on('connect', () => socket.write(`${JSON.stringify({ command })}\n`))
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      if (buffer.includes('\n')) {
        socket.end()
        resolve(buffer.trim())
      }
    })
    socket.on('error', (error) => resolve(`ipc error: ${error.message}`))
    setTimeout(() => {
      socket.destroy()
      resolve(`ipc timeout; partial=${buffer}`)
    }, 3000)
  })
}

async function runVariant(variant) {
  const host = new BaseWindow({ width: 960, height: 540, backgroundColor: '#000000', title: 'spike' })
  const overlay = new BrowserWindow({
    parent: host,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false
  })
  await overlay.loadURL(
    'data:text/html,<body style="margin:0;background:transparent"><div style="position:absolute;bottom:40px;width:100%;text-align:center;font:bold 36px sans-serif;color:white;text-shadow:0 0 4px black">OVERLAY SUBTITLE TEXT</div></body>'
  )
  const sync = () => overlay.setBounds(host.getContentBounds())
  host.on('resize', sync)
  host.on('move', sync)
  host.on('enter-full-screen', sync)
  host.on('leave-full-screen', sync)
  sync()
  overlay.show()

  const handle = host.getNativeWindowHandle()
  const wid = handle.byteLength >= 8 ? handle.readBigUInt64LE(0).toString() : handle.readUInt32LE(0).toString()
  console.log(`[${variant.name}] handle bytes=${handle.byteLength}`)

  const socketDir = mkdtempSync('/tmp/sb-')
  const socketPath = join(socketDir, 'mpv.sock')
  const mpv = spawn(
    mpvPath,
    [
      '--no-config',
      '--idle=no',
      '--keep-open=yes',
      '--osc=no',
      '--force-window=yes',
      '--msg-level=all=warn,vo=v,cocoa=v,mac=v',
      ...variant.args,
      `--wid=${wid}`,
      `--input-ipc-server=${socketPath}`,
      clip
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  mpv.stdout.on('data', (d) => process.stdout.write(`[${variant.name} mpv] ${d}`))
  mpv.stderr.on('data', (d) => process.stdout.write(`[${variant.name} mpv!] ${d}`))
  mpv.on('exit', (code, signal) => console.log(`[${variant.name}] mpv exited code=${code} signal=${signal}`))

  await sleep(6000)
  console.log(`[${variant.name}] vo:`, await mpvCommand(socketPath, ['get_property', 'current-vo']))
  console.log(`[${variant.name}] gpu-context:`, await mpvCommand(socketPath, ['get_property', 'gpu-context']))
  console.log(`[${variant.name}] osd size:`, await mpvCommand(socketPath, ['get_property', 'osd-dimensions']))
  console.log(
    `[${variant.name}] mpv screenshot:`,
    await mpvCommand(socketPath, ['screenshot-to-file', join(outDir, `${variant.name}-mpv-window.png`), 'window'])
  )
  capture(`${variant.name}-windowed`)

  host.setBounds({ x: 100, y: 100, width: 1100, height: 620 })
  await sleep(2000)
  console.log(`[${variant.name}] osd after resize:`, await mpvCommand(socketPath, ['get_property', 'osd-dimensions']))
  capture(`${variant.name}-resized`)

  host.setFullScreen(true)
  await sleep(4000)
  console.log(`[${variant.name}] osd fullscreen:`, await mpvCommand(socketPath, ['get_property', 'osd-dimensions']))
  capture(`${variant.name}-fullscreen`)
  host.setFullScreen(false)
  await sleep(3000)

  host.setSimpleFullScreen(true)
  await sleep(3000)
  capture(`${variant.name}-simplefullscreen`)
  host.setSimpleFullScreen(false)
  await sleep(2000)

  await mpvCommand(socketPath, ['quit'])
  await sleep(1500)
  if (mpv.exitCode === null) mpv.kill('SIGKILL')
  overlay.destroy()
  host.destroy()
  await sleep(1000)
}

app.whenReady().then(async () => {
  for (const variant of variants) {
    try {
      await runVariant(variant)
    } catch (error) {
      console.log(`[${variant.name}] failed: ${error.stack}`)
    }
  }
  app.quit()
})

app.on('window-all-closed', () => {})
