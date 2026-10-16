import type { StremioHandoffResult, StremioHandoffStatus } from '../../shared/media'

/**
 * macOS Stremio handoff without modifying Stremio (Issue #95).
 *
 * Stremio's macOS external-player option "MPV" opens `mpv://<stream URL>` links (stremio-core
 * deep links). Subtitle Bridge declares the `mpv` URL scheme in its Info.plist and, when the user
 * enables the integration, becomes the default handler for it. Patching Stremio's files, as on
 * Windows, would break Stremio's macOS code signature.
 */
export const STREMIO_MPV_SCHEME = 'mpv'

export interface ProtocolClientApi {
  isDefaultProtocolClient(protocol: string): boolean
  setAsDefaultProtocolClient(protocol: string): boolean
  removeAsDefaultProtocolClient(protocol: string): boolean
}

const STREMIO_SETTING = 'In Stremio, set Settings → Player → External player to MPV'

export function macosStremioStatus(api: ProtocolClientApi): StremioHandoffStatus {
  if (api.isDefaultProtocolClient(STREMIO_MPV_SCHEME)) {
    return {
      state: 'enabled',
      message: `Stremio's MPV links open in Subtitle Bridge. ${STREMIO_SETTING} if you have not already.`,
      canEnable: false,
      canDisable: true
    }
  }

  return {
    state: 'disabled',
    message: 'Enable, then in Stremio set Settings → Player → External player to MPV.',
    canEnable: true,
    canDisable: false
  }
}

export function enableMacosStremio(api: ProtocolClientApi): StremioHandoffResult {
  if (api.setAsDefaultProtocolClient(STREMIO_MPV_SCHEME) && api.isDefaultProtocolClient(STREMIO_MPV_SCHEME)) {
    return {
      ok: true,
      message: `Enabled. ${STREMIO_SETTING}, then play any stream.`
    }
  }

  return {
    ok: false,
    message:
      'macOS did not let Subtitle Bridge open MPV links. Move Subtitle Bridge to Applications, open it from there and try again.'
  }
}

export function disableMacosStremio(api: ProtocolClientApi): StremioHandoffResult {
  api.removeAsDefaultProtocolClient(STREMIO_MPV_SCHEME)
  if (api.isDefaultProtocolClient(STREMIO_MPV_SCHEME)) {
    return {
      ok: false,
      message:
        'macOS still sends MPV links to Subtitle Bridge. Set Stremio’s external player back to Disabled to stop handoffs.'
    }
  }

  return {
    ok: true,
    message:
      'Disabled. Set Stremio’s external player back to Disabled if you no longer want Stremio to open an external player.'
  }
}
