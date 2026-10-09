// macOS CI harness for the native video view (Issue #53). Runs inside Electron and drives the
// built out/native/mpv_view.node directly against Homebrew libmpv:
//   resize, native fullscreen with the overlay window, three destroy/recreate cycles, bounded
//   teardown. GitHub's macOS runners have no GPU, so this exercises the software OpenGL path.
// Usage: electron scripts/ci/macos-view-harness.cjs <clip>
const { app, BaseWindow, BrowserWindow, screen } = require('electron')
const { existsSync, mkdtempSync, rmSync } = require('node:fs')
const { createConnection } = require('node:net')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')

const clip = resolve(process.argv.at(-1))
const failures = []
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function check(name, ok, detail) {
  const text = `${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`
  console.log(`::${ok ? 'notice' : 'error'} title=view harness::${text.replace(/[\r\n%]/g, ' ')}`)
  if (!ok) failures.push(name)
}

function loadNative() {
  const module = { exports: {} }
  process.dlopen(module, join(__dirname, '..', '..', 'out', 'native', 'mpv_view.node'))
  return module.exports
}

function mpvCommand(socketPath, command) {
  return new Promise((done) => {
    const socket = createConnection(socketPath)
    let buffer = ''
    const timer = setTimeout(() => {
      socket.destroy()
      done({ error: 'timeout' })
    }, 3000)
    socket.on('connect', () => socket.write(`${JSON.stringify({ command })}\n`))
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        let message
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        if ('error' in message && !('event' in message)) {
          clearTimeout(timer)
          socket.end()
          done(message)
          return
        }
      }
    })
    socket.on('error', (error) => {
      clearTimeout(timer)
      done({ error: error.message })
    })
  })
}

function near(actual, expected) {
  return expected > 0 && Math.abs(actual - expected) / expected < 0.05
}

async function checkRenderSize(socketPath, host, name) {
  // The render context reports the size of the last frame drawn into the view's framebuffer.
  const bounds = host.getContentBounds()
  const scale = screen.getDisplayMatching(bounds).scaleFactor
  const expected = { w: Math.round(bounds.width * scale), h: Math.round(bounds.height * scale) }
  const osd = (await mpvCommand(socketPath, ['get_property', 'osd-dimensions'])).data
  check(name, Boolean(osd) && near(osd.w, expected.w) && near(osd.h, expected.h), {
    osd: osd && { w: osd.w, h: osd.h },
    expected
  })
}

function libmpvPath() {
  return ['/opt/homebrew/lib/libmpv.2.dylib', '/usr/local/lib/libmpv.2.dylib'].find(existsSync)
}

async function run() {
  const native = loadNative()
  const host = new BaseWindow({ width: 960, height: 540, backgroundColor: '#000000', show: true })
  const overlay = new BrowserWindow({
    parent: host,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false
  })
  await overlay.loadURL('data:text/html,<body style="background:transparent"></body>')
  const sync = () => overlay.setBounds(host.getContentBounds())
  for (const event of ['resize', 'move', 'enter-full-screen', 'leave-full-screen']) host.on(event, sync)
  sync()
  overlay.show()

  const viewId = host.getNativeWindowHandle().readBigUInt64LE(0).toString()
  const socketDirectory = mkdtempSync(join(tmpdir(), 'sb-harness-'))

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    const socketPath = join(socketDirectory, `mpv-${cycle}.sock`)
    const player = native.createPlayer(
      libmpvPath(),
      viewId,
      [
        ['config', 'no'],
        ['terminal', 'no'],
        ['idle', 'yes'],
        ['keep-open', 'yes'],
        ['vo', 'libmpv'],
        ['hwdec', 'no'],
        ['input-ipc-server', socketPath]
      ],
      false
    )
    await sleep(300)
    const loaded = await mpvCommand(socketPath, ['loadfile', clip, 'replace'])
    check(`cycle ${cycle}: loadfile`, loaded.error === 'success', loaded)
    await sleep(4000)
    const stats = native.getRenderStats(player)
    check(`cycle ${cycle}: frames rendered`, stats.frames > 0, stats)
    await checkRenderSize(socketPath, host, `cycle ${cycle}: render size matches window`)

    if (cycle === 1) {
      host.setBounds({ x: 80, y: 80, width: 1180, height: 680 })
      await sleep(3000)
      await checkRenderSize(socketPath, host, 'render size follows window resize')

      host.setFullScreen(true)
      await sleep(5000)
      check('window entered fullscreen', host.isFullScreen())
      const display = screen.getDisplayMatching(host.getContentBounds()).bounds
      check('fullscreen content covers the display', host.getContentBounds().width === display.width, {
        content: host.getContentBounds(),
        display
      })
      await checkRenderSize(socketPath, host, 'render size fills fullscreen')
      check(
        'overlay visible over fullscreen video',
        overlay.isVisible() &&
          JSON.stringify(overlay.getBounds()) === JSON.stringify(host.getContentBounds()),
        { overlay: overlay.getBounds(), content: host.getContentBounds() }
      )
      host.setFullScreen(false)
      await sleep(4000)
      await checkRenderSize(socketPath, host, 'render size restored after fullscreen')
      const after = native.getRenderStats(player)
      check('frames still advancing after resize and fullscreen', after.frames > stats.frames, {
        before: stats.frames,
        after: after.frames,
        contextRequests: after.contextRequests
      })
    }

    const started = Date.now()
    native.destroyPlayer(player)
    const elapsed = Date.now() - started
    check(`cycle ${cycle}: destroy finished promptly`, elapsed < 3000, { ms: elapsed })
    const stale = await mpvCommand(socketPath, ['get_property', 'pause'])
    check(`cycle ${cycle}: IPC closed after destroy`, stale.error !== 'success', stale)
    await sleep(500)
  }

  rmSync(socketDirectory, { recursive: true, force: true })
  overlay.destroy()
  host.destroy()
}

app.whenReady().then(async () => {
  try {
    await run()
  } catch (error) {
    check('harness completed without exceptions', false, String(error?.stack ?? error))
  }
  console.log(failures.length === 0 ? 'ALL VIEW CHECKS PASSED' : `FAILED: ${failures.join('; ')}`)
  app.exit(failures.length === 0 ? 0 : 1)
})

app.on('window-all-closed', () => {})
