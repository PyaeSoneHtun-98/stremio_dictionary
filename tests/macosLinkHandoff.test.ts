import { describe, expect, it } from 'vitest'
import {
  disableMacosStremio,
  enableMacosStremio,
  macosStremioStatus,
  type ProtocolClientApi,
  STREMIO_MPV_SCHEME
} from '../src/main/stremio/macosLinkHandoff'

function protocolApi(options: { allowSet?: boolean; stickyDefault?: boolean } = {}) {
  const defaults = new Set<string>()
  const calls: string[] = []
  const api: ProtocolClientApi = {
    isDefaultProtocolClient: (scheme) => defaults.has(scheme),
    setAsDefaultProtocolClient: (scheme) => {
      calls.push(`set:${scheme}`)
      if (options.allowSet === false) return false
      defaults.add(scheme)
      return true
    },
    removeAsDefaultProtocolClient: (scheme) => {
      calls.push(`remove:${scheme}`)
      if (!options.stickyDefault) defaults.delete(scheme)
      return true
    }
  }
  return { api, defaults, calls }
}

describe('macOS Stremio mpv:// link handoff', () => {
  it('claims only the mpv scheme Stremio uses for its macOS MPV external player', () => {
    const { api, calls } = protocolApi()

    expect(STREMIO_MPV_SCHEME).toBe('mpv')
    expect(enableMacosStremio(api)).toMatchObject({ ok: true })
    disableMacosStremio(api)
    expect(calls).toEqual(['set:mpv', 'remove:mpv'])
  })

  it('reports status from the default protocol handler and tells the user what to pick in Stremio', () => {
    const { api, defaults } = protocolApi()

    expect(macosStremioStatus(api)).toMatchObject({
      state: 'disabled',
      canEnable: true,
      canDisable: false
    })
    expect(macosStremioStatus(api).message).toContain('External player to MPV')

    defaults.add('mpv')
    expect(macosStremioStatus(api)).toMatchObject({
      state: 'enabled',
      canEnable: false,
      canDisable: true
    })
  })

  it('reports failure when macOS refuses to make Subtitle Bridge the handler', () => {
    const { api, defaults } = protocolApi({ allowSet: false })

    const result = enableMacosStremio(api)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Applications')
    expect(defaults.size).toBe(0)
  })

  it('reports when macOS keeps sending MPV links after disabling', () => {
    const { api, defaults } = protocolApi({ stickyDefault: true })
    defaults.add('mpv')

    const result = disableMacosStremio(api)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Disabled')
  })
})
