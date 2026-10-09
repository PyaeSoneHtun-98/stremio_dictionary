// Throwaway Issue #53 spike: run Homebrew libmpv *inside* the Electron main process (loaded at
// runtime through koffi, not linked) and embed it with the in-process NSView pointer as `wid`.
// Control stays on mpv's JSON IPC socket, like the Windows child-process design. Removed before review.
const { app, BaseWindow, BrowserWindow, nativeImage, screen } = require('electron')
const { execFileSync } = require('node:child_process')
const { existsSync, mkdtempSync } = require('node:fs')
const { createConnection } = require('node:net')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const outDir = process.env.SPIKE_OUT
const clip = process.env.SPIKE_CLIP
const probe = process.env.SPIKE_PROBE
const variantName = process.env.SPIKE_VARIANT || 'default'
const phase = process.env.SPIKE_PHASE || 'embed'
const variants = {
  default: {},
  'gpu-next-macvk': { vo: 'gpu-next', 'gpu-api': 'vulkan', 'gpu-context': 'macvk' },
  'gpu-macvk': { vo: 'gpu', 'gpu-api': 'vulkan', 'gpu-context': 'macvk' }
}

const failures = []
const label = `libmpv ${variantName}/${phase}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function check(name, ok, detail) {
  const text = `${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`
  console.log(`::${ok ? 'notice' : 'error'} title=${label}::${text.replace(/[\r\n%]/g, ' ')}`)
  if (!ok) failures.push(name)
}

function loadLibmpv() {
  const koffi = require('koffi')
  const path = ['/opt/homebrew/lib/libmpv.2.dylib', '/opt/homebrew/lib/libmpv.dylib'].find(existsSync)
  const lib = koffi.load(path)
  const mpvEvent = koffi.struct('mpv_event', {
    event_id: 'int',
    error: 'int',
    reply_userdata: 'uint64_t',
    data: 'void *'
  })
  return {
    path,
    koffi,
    mpvEvent,
    create: lib.func('void *mpv_create()'),
    setOption: lib.func('int mpv_set_option_string(void *ctx, const char *name, const char *data)'),
    initialize: lib.func('int mpv_initialize(void *ctx)'),
    waitEvent: lib.func('mpv_event *mpv_wait_event(void *ctx, double timeout)'),
    terminateDestroy: lib.func('void mpv_terminate_destroy(void *ctx)'),
    errorString: lib.func('const char *mpv_error_string(int error)')
  }
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

function close(actual, expected) {
  return expected > 0 && Math.abs(actual - expected) / expected < 0.05
}

async function checkOsd(socketPath, bounds, name) {
  const osd = (await mpvCommand(socketPath, ['get_property', 'osd-dimensions'])).data
  const scale = screen.getDisplayMatching(bounds).scaleFactor
  const expected = { width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale) }
  check(name, Boolean(osd) && close(osd.w, expected.width) && close(osd.h, expected.height), {
    osd: osd && { w: osd.w, h: osd.h },
    expected
  })
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

function windowsOwnedBy(pid) {
  return JSON.parse(execFileSync(probe, [String(pid)], { encoding: 'utf8' }))
}

async function createPlayer(mpv, host, cycle) {
  const socketPath = join(mkdtempSync(join(tmpdir(), 'sb-')), 'mpv.sock')
  const ctx = mpv.create()
  check(`cycle ${cycle}: mpv_create returned a handle`, Boolean(ctx))
  const wid = host.getNativeWindowHandle().readBigUInt64LE(0).toString()
  const options = {
    config: 'no',
    idle: 'yes',
    'keep-open': 'yes',
    osc: 'no',
    'input-default-bindings': 'no',
    terminal: 'no',
    ...variants[variantName],
    wid,
    'input-ipc-server': socketPath
  }
  for (const [name, value] of Object.entries(options)) {
    const result = mpv.setOption(ctx, name, value)
    if (result < 0) check(`cycle ${cycle}: set ${name}`, false, mpv.errorString(result))
  }
  const initialized = mpv.initialize(ctx)
  check(`cycle ${cycle}: mpv_initialize`, initialized >= 0, initialized < 0 ? mpv.errorString(initialized) : undefined)

  // libmpv's event queue must be drained by the client.
  const drain = setInterval(() => {
    for (let index = 0; index < 100; index += 1) {
      const event = mpv.koffi.decode(mpv.waitEvent(ctx, 0), mpv.mpvEvent)
      if (event.event_id === 0) break
    }
  }, 50)

  await sleep(300)
  const loaded = await mpvCommand(socketPath, ['loadfile', clip, 'replace'])
  check(`cycle ${cycle}: loadfile over IPC`, loaded.error === 'success', loaded)
  await sleep(4000)

  return {
    socketPath,
    destroy: async () => {
      const started = Date.now()
      clearInterval(drain)
      mpv.terminateDestroy(ctx)
      check(`cycle ${cycle}: mpv_terminate_destroy returned`, true, { ms: Date.now() - started })
    }
  }
}

async function run() {
  const mpv = loadLibmpv()
  check('libmpv loaded at runtime', Boolean(mpv.path), { path: mpv.path })

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

  const cycles = phase === 'recreate' ? 3 : 1
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const player = await createPlayer(mpv, host, cycle)
    const vo = await mpvCommand(player.socketPath, ['get_property', 'current-vo'])
    check(`cycle ${cycle}: video output active`, vo.error === 'success' && Boolean(vo.data), vo)
    const extraWindows = windowsOwnedBy(process.pid).length
    check(`cycle ${cycle}: on-screen app windows`, extraWindows <= 2, { windows: extraWindows })
    await checkOsd(player.socketPath, host.getContentBounds(), `cycle ${cycle}: render size matches host`)

    if (phase === 'embed') {
      const shot = join(outDir, `libmpv-${variantName}-frame.png`)
      await mpvCommand(player.socketPath, ['screenshot-to-file', shot, 'window'])
      await sleep(500)
      const brightness = meanBrightness(shot)
      check('rendered a non-black frame', brightness > 20, { brightness })
      execFileSync('screencapture', ['-x', join(outDir, `libmpv-${variantName}-windowed.png`)])
      host.setBounds({ x: 120, y: 120, width: 1100, height: 620 })
      await sleep(2500)
      await checkOsd(player.socketPath, host.getContentBounds(), 'render size follows host resize')
    }

    if (phase === 'fullscreen') {
      host.setFullScreen(true)
      await sleep(5000)
      check('host entered fullscreen', host.isFullScreen())
      await checkOsd(player.socketPath, host.getContentBounds(), 'render size fills fullscreen host')
      const overlayId = Number(overlay.getMediaSourceId().split(':')[1])
      check('overlay on screen in fullscreen', windowsOwnedBy(process.pid).some((w) => w.id === overlayId))
      execFileSync('screencapture', ['-x', join(outDir, `libmpv-${variantName}-fullscreen.png`)])
      host.setFullScreen(false)
      await sleep(3000)
    }

    await player.destroy()
    await sleep(1000)
  }

  overlay.destroy()
  host.destroy()
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
