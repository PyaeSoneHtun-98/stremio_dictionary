// Throwaway Issue #53 spike: can Homebrew mpv render inside an Electron window on macOS via
// --wid, with a transparent child overlay window on top? One variant + phase per run; exits
// non-zero when any check fails so the CI step result answers the question. Removed before review.
const { app, BaseWindow, BrowserWindow, nativeImage, screen } = require('electron')
const { spawn, execFileSync } = require('node:child_process')
const { mkdtempSync } = require('node:fs')
const { createConnection } = require('node:net')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const outDir = process.env.SPIKE_OUT
const clip = process.env.SPIKE_CLIP
const probe = process.env.SPIKE_PROBE
const variantName = process.env.SPIKE_VARIANT || 'default'
const phase = process.env.SPIKE_PHASE || 'embed'
const mpvPath = process.env.MPV_PATH || 'mpv'

const variants = {
  default: [],
  'gpu-next-macvk': ['--vo=gpu-next', '--gpu-api=vulkan', '--gpu-context=macvk'],
  'gpu-macvk': ['--vo=gpu', '--gpu-api=vulkan', '--gpu-context=macvk'],
  'default-hwdec': ['--hwdec=auto-safe']
}

const failures = []
const label = `${variantName}/${phase}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function check(name, ok, detail) {
  const text = `${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`
  // Workflow-command annotations are readable through the public checks API.
  console.log(`::${ok ? 'notice' : 'error'} title=${label}::${text.replace(/[\r\n%]/g, ' ')}`)
  if (!ok) failures.push(name)
}

function capture(name) {
  try {
    execFileSync('screencapture', ['-x', join(outDir, `${variantName}-${name}.png`)])
  } catch (error) {
    console.log(`[${label}] screencapture failed: ${error.message}`)
  }
}

function windowsOwnedBy(...pids) {
  return JSON.parse(execFileSync(probe, pids.map(String), { encoding: 'utf8' }))
}

function mpvCommand(socketPath, command) {
  return new Promise((resolve) => {
    const socket = createConnection(socketPath)
    let buffer = ''
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ error: 'timeout' })
    }, 3000)
    socket.on('connect', () => socket.write(`${JSON.stringify({ command })}\n`))
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        if ('error' in message && !('event' in message)) {
          clearTimeout(timer)
          socket.end()
          resolve(message)
          return
        }
      }
    })
    socket.on('error', (error) => {
      clearTimeout(timer)
      resolve({ error: error.message })
    })
  })
}

function expectedPixels(bounds) {
  const scale = screen.getDisplayMatching(bounds).scaleFactor
  return { width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale), scale }
}

function close(actual, expected) {
  return expected > 0 && Math.abs(actual - expected) / expected < 0.05
}

async function checkOsdTracks(socketPath, bounds, name) {
  const osd = (await mpvCommand(socketPath, ['get_property', 'osd-dimensions'])).data
  const expected = expectedPixels(bounds)
  check(
    name,
    Boolean(osd) && close(osd.w, expected.width) && close(osd.h, expected.height),
    { osd: osd && { w: osd.w, h: osd.h }, expected }
  )
}

function meanBrightness(pngPath) {
  const image = nativeImage.createFromPath(pngPath)
  if (image.isEmpty()) return -1
  const bitmap = image.toBitmap()
  let total = 0
  for (let index = 0; index < bitmap.length; index += 4) {
    total += (bitmap[index] + bitmap[index + 1] + bitmap[index + 2]) / 3
  }
  return total / (bitmap.length / 4)
}

async function run() {
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
  for (const event of ['resize', 'move', 'enter-full-screen', 'leave-full-screen']) host.on(event, sync)
  sync()
  overlay.show()

  const handle = host.getNativeWindowHandle()
  const wid = handle.readBigUInt64LE(0).toString()
  const socketPath = join(mkdtempSync(join(tmpdir(), 'sb-')), 'mpv.sock')
  const mpv = spawn(
    mpvPath,
    [
      '--no-config',
      '--idle=yes',
      '--keep-open=yes',
      '--no-osc',
      '--no-terminal',
      ...variants[variantName],
      `--wid=${wid}`,
      `--input-ipc-server=${socketPath}`,
      clip
    ],
    { stdio: 'ignore' }
  )
  let mpvExit = null
  mpv.on('exit', (code, signal) => {
    mpvExit = { code, signal }
  })

  await sleep(6000)
  check('mpv still running after start', mpvExit === null, mpvExit ?? undefined)
  // mpv replies {"error":"success","data":...} for successful IPC commands.
  const vo = await mpvCommand(socketPath, ['get_property', 'current-vo'])
  check('mpv video output active', vo.error === 'success' && Boolean(vo.data), vo)
  const mpvWindows = windowsOwnedBy(mpv.pid)
  check('mpv opened no standalone window', mpvWindows.length === 0, mpvWindows)

  if (phase === 'embed') {
    await checkOsdTracks(socketPath, host.getContentBounds(), 'mpv render size matches host')
    const screenshot = join(outDir, `${variantName}-mpv-frame.png`)
    await mpvCommand(socketPath, ['screenshot-to-file', screenshot, 'window'])
    await sleep(500)
    const brightness = meanBrightness(screenshot)
    check('mpv rendered a non-black frame', brightness > 20, { brightness })
    capture('windowed')

    host.setBounds({ x: 120, y: 120, width: 1100, height: 620 })
    await sleep(2500)
    await checkOsdTracks(socketPath, host.getContentBounds(), 'mpv render size follows host resize')
    capture('resized')
  } else {
    if (phase === 'fullscreen') host.setFullScreen(true)
    else host.setSimpleFullScreen(true)
    await sleep(5000)
    const fullscreen = phase === 'fullscreen' ? host.isFullScreen() : host.isSimpleFullScreen()
    check('host entered fullscreen', fullscreen)
    const contentBounds = host.getContentBounds()
    const display = screen.getDisplayMatching(contentBounds).bounds
    check('host covers the display', contentBounds.width === display.width, { contentBounds, display })
    await checkOsdTracks(socketPath, contentBounds, 'mpv render size fills fullscreen host')
    const overlayBounds = overlay.getBounds()
    check(
      'overlay bounds match fullscreen host',
      JSON.stringify(overlayBounds) === JSON.stringify(contentBounds),
      { overlayBounds, contentBounds }
    )
    const overlayId = Number(overlay.getMediaSourceId().split(':')[1])
    const visible = windowsOwnedBy(process.pid).some((window) => window.id === overlayId)
    check('overlay is on screen in fullscreen', visible, { overlayId })
    check('mpv still running in fullscreen', mpvExit === null, mpvExit ?? undefined)
    capture(phase)
  }

  await mpvCommand(socketPath, ['quit'])
  await sleep(1000)
  if (mpvExit === null) mpv.kill('SIGKILL')
}

app.whenReady().then(async () => {
  try {
    await run()
  } catch (error) {
    check('spike completed without exceptions', false, error.stack)
  }
  console.log(`[${label}] ${failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILED: ${failures.join('; ')}`}`)
  app.exit(failures.length === 0 ? 0 : 1)
})

app.on('window-all-closed', () => {})
