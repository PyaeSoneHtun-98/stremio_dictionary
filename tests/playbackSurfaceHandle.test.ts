import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BaseWindow: class {}, BrowserWindow: class {}, app: {} }))
import { nativeHandleToMpvWindowId } from '../src/main/media/PlaybackSurface'

describe('native window handle conversion for mpv --wid', () => {
  it('keeps the Windows HWND uint32 conversion', () => {
    const handle = Buffer.alloc(8)
    handle.writeUInt32LE(0x00a1b2c3, 0)
    handle.writeUInt32LE(0xffffffff, 4)

    expect(nativeHandleToMpvWindowId(handle, 'win32')).toBe(String(0x00a1b2c3))
  })

  it('passes the full 64-bit NSView pointer on macOS', () => {
    const handle = Buffer.alloc(8)
    handle.writeBigUInt64LE(0x0000600003a1b2c0n, 0)

    expect(nativeHandleToMpvWindowId(handle, 'darwin')).toBe(0x0000600003a1b2c0n.toString())
  })

  it('rejects truncated handles and unsupported platforms', () => {
    expect(() => nativeHandleToMpvWindowId(Buffer.alloc(4), 'darwin')).toThrow('invalid native window handle')
    expect(() => nativeHandleToMpvWindowId(Buffer.alloc(2), 'win32')).toThrow('invalid native window handle')
    expect(() => nativeHandleToMpvWindowId(Buffer.alloc(8), 'linux')).toThrow('Windows and macOS only')
  })
})
